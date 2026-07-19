import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const showModule = require('../electron/show.js');

const tempDirs = [];

function createLegacyShowFile(scripts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-show-schema-'));
  tempDirs.push(dir);
  const filePath = path.join(dir, 'test.show.json');
  const original = {
    version: '1.0',
    fixtures: [],
    pages: {},
    scripts,
  };
  const raw = JSON.stringify(original, null, 2);
  fs.writeFileSync(filePath, raw, 'utf-8');
  return { filePath, original, raw };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('schema de scripts do show', () => {
  it('migra um show legado para scriptLibrary e scriptPages sem manter scripts', () => {
    const { filePath } = createLegacyShowFile({
      F1: { name: 'efeito-um', file: 'C:\\antigo\\efeito-um.js', color: '#112233' },
      F2: { name: 'efeito-dois', file: 'C:\\antigo\\efeito-dois.js', color: '#445566' },
      F10: { name: 'efeito-dez', file: 'C:\\antigo\\efeito-dez.js' },
    });

    const migrated = showModule.loadShow(filePath);

    expect(migrated.scriptSchemaVersion).toBe(showModule.SCRIPT_SCHEMA_VERSION);
    expect(migrated).not.toHaveProperty('scripts');
    expect(migrated.scriptLibrary).toMatchObject({
      'efeito-um': { id: 'efeito-um', entry: 'efeito-um.js', label: 'efeito-um', color: '#112233' },
      'efeito-dois': { id: 'efeito-dois', entry: 'efeito-dois.js', label: 'efeito-dois', color: '#445566' },
      'efeito-dez': { id: 'efeito-dez', entry: 'efeito-dez.js', label: 'efeito-dez', color: '#000000' },
    });
    expect(migrated.scriptPages.pages[0].slots).toEqual({
      F1: { type: 'script', id: 'efeito-um' },
      F2: { type: 'script', id: 'efeito-dois' },
      F10: { type: 'script', id: 'efeito-dez' },
    });
    const persisted = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(persisted.scriptSchemaVersion).toBe(showModule.SCRIPT_SCHEMA_VERSION);
    expect(persisted).not.toHaveProperty('scripts');
  });

  it('cria backup com o conteúdo original antes da migração', () => {
    const { filePath, raw } = createLegacyShowFile({
      F1: { name: 'efeito', file: 'C:\\morto\\efeito.js', color: '#abcdef' },
    });

    showModule.loadShow(filePath);

    const backupPath = `${filePath}.pre-script-migration.bak`;
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(fs.readFileSync(backupPath, 'utf-8')).toBe(raw);
  });

  it('é idempotente ao carregar duas vezes o mesmo arquivo já migrado', () => {
    const { filePath } = createLegacyShowFile({
      F1: { name: 'efeito-um', color: '#123456' },
      F2: { name: 'efeito-dois', color: '#654321' },
    });

    const first = showModule.loadShow(filePath);
    const backupPath = `${filePath}.pre-script-migration.bak`;
    const backupBefore = fs.readFileSync(backupPath, 'utf-8');
    const backupMtimeBefore = fs.statSync(backupPath).mtimeMs;

    const second = showModule.loadShow(filePath);

    expect(second).toEqual(first);
    expect(Object.keys(second.scriptLibrary)).toHaveLength(2);
    expect(fs.readFileSync(backupPath, 'utf-8')).toBe(backupBefore);
    expect(fs.statSync(backupPath).mtimeMs).toBe(backupMtimeBefore);
  });

  it('cria pelo menos seis páginas mesmo com poucas F-Keys legadas', () => {
    const { filePath } = createLegacyShowFile({
      F1: { name: 'efeito-um' },
      F2: { name: 'efeito-dois' },
    });

    const migrated = showModule.loadShow(filePath);

    expect(migrated.scriptPages.pages).toHaveLength(showModule.MIN_SCRIPT_PAGES);
    expect(migrated.scriptPages.pages.map(page => page.id)).toEqual([
      'page-1', 'page-2', 'page-3', 'page-4', 'page-5', 'page-6',
    ]);
  });

  it('normalizeScriptPages nunca trunca páginas extras', () => {
    const pages = Array.from({ length: 8 }, (_, index) => ({
      id: `custom-${index + 1}`,
      name: `Custom ${index + 1}`,
      order: index + 1,
      slots: {},
    }));

    const normalized = showModule.normalizeScriptPages({ pages });

    expect(normalized.pages).toHaveLength(8);
    expect(normalized.pages.map(page => page.id)).toEqual(pages.map(page => page.id));
  });

  it('isSafeRelativeEntry aceita somente caminhos relativos seguros', () => {
    expect(showModule.isSafeRelativeEntry('C:\\algo\\script.js')).toBe(false);
    expect(showModule.isSafeRelativeEntry('/etc/passwd')).toBe(false);
    expect(showModule.isSafeRelativeEntry('../fora/script.js')).toBe(false);
    expect(showModule.isSafeRelativeEntry('sub/../../fora.js')).toBe(false);
    expect(showModule.isSafeRelativeEntry('')).toBe(false);
    expect(showModule.isSafeRelativeEntry('script.js')).toBe(true);
    expect(showModule.isSafeRelativeEntry('subpasta/script.js')).toBe(true);
    // drive-relative do Windows (sem barra após os dois-pontos) e Alternate Data Stream do NTFS
    expect(showModule.isSafeRelativeEntry('C:foo.js')).toBe(false);
    expect(showModule.isSafeRelativeEntry('foo.js:hidden')).toBe(false);
    expect(showModule.isSafeRelativeEntry('\\\\servidor\\share\\script.js')).toBe(false);
    expect(showModule.isSafeRelativeEntry('foo//bar.js')).toBe(false);
  });

  it('mantém só a primeira associação quando duas F-Keys usam o mesmo nome', () => {
    const result = showModule.migrateLegacyScriptsToLibrary({
      F2: { name: 'duplicado', color: '#222222' },
      F1: { name: 'duplicado', color: '#111111' },
    });

    expect(result.scriptPages.pages[0].slots).toEqual({
      F1: { type: 'script', id: 'duplicado' },
    });
    expect(Object.keys(result.scriptLibrary)).toEqual(['duplicado']);
    expect(result.scriptLibrary.duplicado.color).toBe('#111111');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('F2');
    expect(result.warnings[0]).toContain('Associação duplicada');
  });

  it('slugifyScriptId produz kebab-case estável sem acentos', () => {
    expect(showModule.slugifyScriptId('  ÁGUA Quente / TESTE  ')).toBe('agua-quente-teste');
    expect(showModule.slugifyScriptId('Água Quente / Teste')).toBe('agua-quente-teste');
  });
});
