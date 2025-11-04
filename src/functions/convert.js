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
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      if (!boundaryMatch) throw new Error('Content-Type multipart sense boundary');

      const bodyBuffer = Buffer.from(await request.arrayBuffer());
      const parts = multipart.Parse(bodyBuffer, boundaryMatch[1]);
      const filePart = parts.find(p => p && p.filename);
      if (!filePart) throw new Error('No s’ha trobat cap fitxer al camp "file"');

      const { value: html } = await mammoth.convertToHtml({ buffer: filePart.data });

      const $ = cheerio.load(html);
      const blocks = [];
      const stack = [];

      const pushChunk = (pathArr, nodes) => {
        if (!nodes.length) return;
        const fragHtml = nodes.map(n => $.html(n)).join('');
        const text = $(fragHtml).text().replace(/\s+\n/g, '\n').trim().normalize('NFC');
        if (!text) return;
        blocks.push({
          path: pathArr.map(x => x.title).join(' > '),
          level: pathArr[pathArr.length - 1].level,
          title: pathArr[pathArr.length - 1].title,
          html: fragHtml,
          text
        });
      };

      let buffer = [];
      $('body').children().each((_, el) => {
        const tag = el.tagName?.toLowerCase();
        const m = tag?.match(/^h([1-6])$/);
        if (m) {
          if (stack.length) pushChunk(stack, buffer), buffer = [];
          const level = parseInt(m[1], 10);
          const title = $(el).text().trim().normalize('NFC');
          while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
          stack.push({ level, title });
        } else {
          buffer.push(el);
        }
      });
      if (stack.length) pushChunk(stack, buffer);

      const rawName = filePart.filename || 'documento.docx';
      const safeName = Buffer.from(rawName, 'latin1').toString('utf8');

      return {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
        jsonBody: {
          fileName: safeName,
          contentType: filePart.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          chunks: blocks,
          headings: $('h1,h2,h3,h4,h5,h6').map((_, h) => ({
            level: h.tagName.toLowerCase(),
            text: $(h).text().trim().normalize('NFC')
          })).get()
        }
      };
    } catch (err) {
      context.log.error(err);
      return { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' }, jsonBody: { error: err.message || 'Error processant el document.' } };
    }
  }
});
