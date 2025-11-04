Azure Function per al RAG de Barraquer
Aquesta és una Azure Function (Node.js v4) dissenyada per al projecte RAG de la Clínica Barraquer.

Visió General
La seva funció principal és rebre documents .docx (protocols, guies) i processar-los per extreure no només el text, sinó també l'estructura semàntica basada en els títols (H1, H2, H3...).
Això permet una indexació de documents (chunking) de molta més qualitat, ja que cada fragment de text es desa a la base de dades vectorial amb metadades clau com el títol del capítol i la seva ruta jeràrquica (path).

Què fa?
1. Rep un fitxer .docx via POST.
2. El converteix a HTML utilitzant mammoth.
3. Analitza l'HTML amb cheerio per identificar els títols (h1 a h6).
4. Agrupa el text que hi ha sota cada títol.
5. Neteja i normalitza els accents (NFC) i la codificació de caràcters (latin1 -> utf8).
6. Retorna una resposta JSON (codificada en UTF-8) a punt per ser processada per n8n.

Endpoint
    Mètode: POST
    Ruta: /api/convert
    Cos (Body): multipart/form-data
    Camp: file (Aquí és on ha d'anar el fitxer .docx)

Resposta (Output)
Retorna un objecte JSON amb la següent estructura:
{
  "fileName": "NomDelFitxer.docx",
  "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "chunks": [
    {
      "path": "Títol Principal > Subtítol 1.1",
      "level": 2,
      "title": "Subtítol 1.1",
      "html": "...",
      "text": "Contingut de text d'aquest chunk..."
    }
  ],
  "headings": [
    { "level": "h1", "text": "Títol Principal" }
  ]
}

Desplegament (Passos per a IT)
Aquest codi està llest per ser desplegat a un recurs "Function App" (Aplicació de funcions) de Node.js a Azure.
La manera més senzilla és utilitzar el Centre d'implementació (Deployment Center) del vostre recurs "Function App" a Azure:
1. Crear un recurs "Function App" a Azure (Pla de consum, Node.js 20 LTS, basat en Codi).
2. Anar a la secció "Centre d'implementació".
3. Com a "Origen", seleccionar GitHub.
4. Autoritzar i connectar al vostre compte de GitHub (o a l'organització a2dinnova).
5. Seleccionar el repositori: a2dinnova/azure-function-rag
6. Seleccionar la branca: main
7. Desar la configuració.
Azure es connectarà automàticament al repositori, descarregarà el codi, executarà npm install (per mammoth, cheerio, etc.) i desplegarà la funció convert.

Dependències
Les dependències clau estan definides a package.json:
    @azure/functions
    mammoth
    cheerio
    parse-multipart