// --- BU DOSYA VERCEL'DE ÇALIŞACAK (NODE.JS) ---
// Öğrenci bu dosyayı asla göremez.

// Doğru cevaplar (sunucuda saklanıyor)
const correctAnswers = {
    a: "Şekilde verilen pil tutucusunda piller, seri olarak bağlanmıştır. Seri bağlantı, bir pilin pozitif kutbunun bir sonraki pilin negatif kutbuna bağlanmasıyla oluşur. Bu bağlanma şekli ile toplam potansiyel fark, devreye bağlı pillerin potansiyel farkının toplanması ile hesaplanır. Pil sayısı arttıkça artar.",
    b: "Avantajları: Pil tutucularının çoğu, seri bağlanmayı destekleyecek şekilde tasarlanmıştır. Seri bağlanma sayesinde pillerin potansiyel farkları toplanarak devreye daha yüksek bir enerji sağlanır. Elektronik cihazlarda yaygın olarak kullanılır. Dezavantajları: Seri bağlı pillerde toplam akım bir pilin sağladığı akımla sınırlıdır. Pillerden biri arızalanırsa veya tükenirse devre çalışmayı durdurur. Seri bağlantı, genellikle daha fazla pil kullanımını gerektirir; bu da daha fazla yer kaplar."
};

// Vercel/Netlify'de bu şekilde çağrılır
export default async function handler(request, response) {
    // Sadece POST isteklerini kabul et
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // 1. Öğrencinin cevabını al
        const { studentAnswerA, studentAnswerB } = request.body;
        
        // 2. GİZLİ API ANAHTARINI ÇEK
        // Bu anahtar Vercel'in "Environment Variables" ayarından gelir, KODUN İÇİNDE DEĞİLDİR.
        const apiKey = process.env.GEMINI_API_KEY; 
        
        if (!apiKey) {
            // Sunucuda bu hatayı logla, öğrenciye daha basit bir mesaj göster
            console.error('API anahtarı sunucuda ayarlanmamış.');
            return response.status(500).json({ error: 'Sunucu yapılandırma hatası.' });
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // 3. Gemini API'ye gönderilecek talimat (Prompt)
        // JSON formatını zorunlu kılıyoruz
        const systemPrompt = `Sen uzman bir fizik öğretmenisin. Görevin, öğrencinin cevabını, 'Doğru Cevap' ile karşılaştırmaktır. İnternetten bilgi arama, sadece verdiğim iki metni kıyasla.
        
Cevabı MUTLAKA şu JSON formatında ver:
{
  "overallStatus": "Doğru" | "Kısmen Doğru" | "Yanlış",
  "evaluationA": {
    "status": "Doğru" | "Kısmen Doğru" | "Yanlış",
    "feedback": "Kısa, açıklayıcı geri bildirim."
  },
  "evaluationB": {
    "status": "Doğru" | "Kısmen Doğru" | "Yanlış",
    "feedback": "Kısa, açıklayıcı geri bildirim."
  }
}
`;
        
        const userQuery = `
--- DOĞRU CEVAPLAR (ANAHTAR) ---
Soru A: ${correctAnswers.a}
Soru B: ${correctAnswers.b}

--- ÖĞRENCİ CEVAPLARI ---
Soru A: ${studentAnswerA}
Soru B: ${studentAnswerB}

---
Lütfen bu öğrenci cevaplarını, verdiğim doğru cevap anahtarına göre kıyasla ve JSON formatında değerlendir.
`;

        // 4. Gemini API'ye isteği gönder
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userQuery }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    responseMimeType: "application/json",
                }
            })
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Gemini API Hatası:", errorText);
            return response.status(500).json({ error: 'Değerlendirme servisi yanıt vermiyor.' });
        }

        const result = await apiResponse.json();
        
        // 5. Gelen cevabı (JSON) doğrudan öğrenciye (index.html) geri gönder
        // Bazen text boş gelebilir veya format bozuk olabilir, kontrol edelim
        if (!result.candidates || !result.candidates[0].content.parts[0].text) {
             console.error('Gemini API\'den boş veya hatalı formatlı yanıt:', JSON.stringify(result));
             return response.status(500).json({ error: 'Değerlendirme formatı anlaşılamadı.' });
        }

        const evaluationText = result.candidates[0].content.parts[0].text;
        
        try {
            const evaluationJson = JSON.parse(evaluationText); 
            // 6. Başarılı JSON yanıtını öğrenciye gönder
            return response.status(200).json(evaluationJson);
        } catch (parseError) {
            console.error('API\'den gelen JSON parse edilemedi:', evaluationText);
            return response.status(500).json({ error: 'Değerlendirme yanıtı işlenemedi.' });
        }

    } catch (error) {
        console.error('Genel sunucu hatası:', error);
        return response.status(500).json({ error: error.message || 'Sunucuda bilinmeyen bir hata oluştu.' });
    }
}
