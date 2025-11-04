const { app } = require('@azure/functions');
const multipart = require('parse-multipart');
const mammoth = require('mammoth');
const cheerio = require('cheerio');

app.http('convert', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const contentType = request.headers.get('content-type') || '';
      // Extreu el boundary del multipart
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      if (!boundaryMatch) throw new Error('Content-Type multipart sense boundary');

      const bodyBuffer = Buffer.from(await request.arrayBuffer());
      const parts = multipart.Parse(bodyBuffer, boundaryMatch[1]);

      const filePart = parts.find(p => p && p.filename);
      if (!filePart) throw new Error('No s’ha trobat cap fitxer al camp "file"');

      // DOCX -> HTML
      const { value: html } = await mammoth.convertToHtml({ buffer: filePart.data });

      // === Agrupació per títols h1..h6 amb cheerio ===
      const $ = cheerio.load(html);
      const blocks = []; // chunks plans
      const stack = [];  // pila de seccions {level,title,html}

      // ajunta nodes fins al següent heading
      const pushChunk = (pathArr, nodes) => {
        if (!nodes.length) return;
        const fragHtml = nodes.map(n => $.html(n)).join('');
        const text = $(fragHtml).text().replace(/\s+\n/g, '\n').trim();
        if (!text) return;

        blocks.push({
          path: pathArr.map(x => x.title).join(' > '), // ex: "1. Polítiques... > 1.1 Avisos..."
          level: pathArr[pathArr.length - 1].level,
          title: pathArr[pathArr.length - 1].title,
          html: fragHtml,
          text
        });
      };

      // Recorre tots els fills del body i va creant seccions
      let buffer = [];
      $('body').children().each((_, el) => {
        const tag = el.tagName?.toLowerCase();
        const m = tag?.match(/^h([1-6])$/);
        if (m) {
          // Aboca el buffer a la secció actual (si n'hi ha)
          if (stack.length) pushChunk(stack, buffer), buffer = [];

          const level = parseInt(m[1], 10);
          const title = $(el).text().trim();

          // Puja/baixa en la jerarquia
          while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
          stack.push({ level, title });
        } else {
          buffer.push(el);
        }
      });
      // aboca el que queda
      if (stack.length) pushChunk(stack, buffer);

      return {
        jsonBody: {
          fileName: filePart.filename,
          contentType: filePart.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          chunks: blocks,       // llista plana per la teva base vectorial
          headings: $('h1,h2,h3,h4,h5,h6').map((_, h) => ({
            level: h.tagName.toLowerCase(),
            text: $(h).text().trim()
          })).get()
        }
      };
    } catch (err) {
      context.log.error(err);
      return { status: 400, jsonBody: { error: err.message || 'Error processant el document.' } };
    }
  }
});
