import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  canonicalScriptPath,
  correlateRenameCandidate,
} = require('../electron/scriptWatcherLogic');

describe('scriptWatcherLogic', () => {
  describe('canonicalScriptPath', () => {
    it('converte arquivo direto em nome relativo simples', () => {
      const scriptsDir = path.join(path.parse(process.cwd()).root, 'tmp', 'scripts');
      const absPath = path.join(scriptsDir, 'arquivo.js');

      expect(canonicalScriptPath(scriptsDir, absPath)).toBe('arquivo.js');
    });

    it('normaliza caminho em subpasta para barras /', () => {
      const scriptsDir = path.join(path.parse(process.cwd()).root, 'tmp', 'scripts');
      const absPath = path.join(scriptsDir, 'sub', 'arquivo.js');

      expect(canonicalScriptPath(scriptsDir, absPath)).toBe('sub/arquivo.js');
    });
  });

  describe('correlateRenameCandidate', () => {
    it('retorna no-hash quando o hash novo não pôde ser calculado', () => {
      expect(correlateRenameCandidate([], 'novo.js', null)).toEqual({ status: 'no-hash' });
    });

    it('retorna none sem remoção pendente compatível', () => {
      expect(correlateRenameCandidate([], 'novo.js', 'hash-a')).toEqual({ status: 'none' });
    });

    it('correlaciona exatamente uma remoção com o mesmo hash', () => {
      const pending = [{ canonicalPath: 'antigo.js', hash: 'hash-a' }];

      expect(correlateRenameCandidate(pending, 'novo.js', 'hash-a')).toEqual({
        status: 'matched',
        oldCanonicalPath: 'antigo.js',
      });
    });

    it('não escolhe silenciosamente entre dois candidatos com o mesmo hash', () => {
      const pending = [
        { canonicalPath: 'primeiro.js', hash: 'hash-a' },
        { canonicalPath: 'segundo.js', hash: 'hash-a' },
      ];

      expect(correlateRenameCandidate(pending, 'novo.js', 'hash-a')).toEqual({
        status: 'ambiguous',
        candidates: ['primeiro.js', 'segundo.js'],
      });
    });

    it('ignora candidato cujo caminho já é igual ao caminho novo', () => {
      const pending = [{ canonicalPath: 'mesmo.js', hash: 'hash-a' }];

      expect(correlateRenameCandidate(pending, 'mesmo.js', 'hash-a')).toEqual({ status: 'none' });
    });
  });
});
