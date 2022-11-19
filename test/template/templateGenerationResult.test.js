/**
 * @jest-environment node
 */

const { readFile } = require('fs').promises;
const path = require('path');
const Generator = require('@asyncapi/generator');
const outputDir = path.resolve('test/temp/templateGenerationResult', Math.random().toString(36).substring(7));

describe('templateGenerationResult()', () => {
  jest.setTimeout(1000000);

  const params = {
    server: 'localhost'
  };

  beforeAll(async() => {
    const generator = new Generator('./', outputDir, { forceWrite: true, templateParams: params });
    await generator.generateFromFile(path.resolve('test','streaming.yaml')); 
  });

  it('generated correct streaming client code', async () => {
    const clientJSCode = await readFile(path.join(outputDir, 'client.js'), 'utf8');
    const clientPYCode = await readFile(path.join(outputDir, 'client.py'), 'utf8');
  });
});
