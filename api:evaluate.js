// --- BU DOSYA VERCEL'DE ÇALIŞACAK (NODE.JS) ---
// Öğrenci bu dosyayı asla göremez.

// Doğru cevaplar (sunucuda saklanıyor)
const correctAnswers = {
    a: "Şekilde verilen pil tutucusunda piller, seri olarak bağlanmıştır. Seri bağlantı, bir pilin pozitif kutbunun bir sonraki pilin negatif kutbuna bağlanmasıyla oluşur...",
    b: "Avantajları: ...daha yüksek bir enerji sağlanır. Dezavantajları: ...toplam akım sınırlıdır. Pillerden biri arızalanırsa devre çalışmayı durdurur."
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
            throw new Error('API anahtarı sunucuda ayarlanmamış.');
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

        // 3. Gemini API'ye gönderilecek talimat (Prompt)
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
            console.error("API Hatası:", await apiResponse.text());
            throw new Error('Gemini API yanıt vermiyor.');
        }

        const result = await apiResponse.json();
        
        // 5. Gelen cevabı (JSON) doğrudan öğrenciye (index.html) geri gönder
        const evaluationText = result.candidates[0].content.parts[0].text;
        const evaluationJson = JSON.parse(evaluationText); 
        
        response.status(200).json(evaluationJson);

    } catch (error) {
        console.error('Sunucu hatası:', error);
        response.status(500).json({ error: error.message || 'Sunucuda bilinmeyen bir hata oluştu.' });
    }
}
