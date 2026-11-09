import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { expect, test } from 'vitest';
import catalog from '../apps/web/src/i18n/errors.pt-BR.js';
import { messages as allMessages } from '../apps/web/src/i18n/index.js';

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') return sourceFiles(filename);
      return entry.isFile() && /\.tsx?$/.test(filename) ? [filename] : [];
    }),
  );
  return files.flat();
}

test('server validation, public error fallbacks and template default issues have Portuguese translations', async () => {
  const filenames = [...(await sourceFiles('apps/server/src')), ...(await sourceFiles('packages'))];
  const messages = new Set<string>();
  for (const filename of filenames) {
    const source = ts.createSourceFile(
      filename,
      await readFile(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const add = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        messages.add(node.text);
      else if (ts.isConditionalExpression(node)) {
        add(node.whenTrue);
        add(node.whenFalse);
      }
    };
    const visit = (node: ts.Node) => {
      if (
        ts.isNewExpression(node) &&
        node.expression.getText(source) === 'DomainError' &&
        node.arguments?.[1]
      )
        add(node.arguments[1]);
      if (
        ['templates/defaults.ts', 'apps/server/src/app.ts', 'documents/collaboration.ts'].some(
          (suffix) => filename.replaceAll('\\', '/').endsWith(suffix),
        ) &&
        ts.isPropertyAssignment(node) &&
        node.name.getText(source) === 'message'
      )
        add(node.initializer);
      if (filename.replaceAll('\\', '/').endsWith('data/src/formulas.ts')) {
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(source) === 'fail' &&
          node.arguments[0]
        )
          add(node.arguments[0]);
        if (ts.isParameter(node) && node.name.getText(source) === 'message' && node.initializer)
          add(node.initializer);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(messages.size).toBeGreaterThan(200);
  expect([...messages].filter((message) => !catalog[message])).toEqual([]);
  expect(catalog['AUTH_SECRET is required in production.']).toBeUndefined();
});

test('client error and warning source messages all have Portuguese translations', async () => {
  const missing = new Set<string>();
  for (const filename of await sourceFiles('apps/web/src')) {
    if (filename.replaceAll('\\', '/').includes('/i18n/')) continue;
    const source = ts.createSourceFile(
      filename,
      await readFile(filename, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const add = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (node.text.trim() && !Object.hasOwn(allMessages, node.text)) missing.add(node.text);
      } else if (ts.isConditionalExpression(node)) {
        add(node.whenTrue);
        add(node.whenFalse);
      } else if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      )
        add(node.right);
    };
    const visit = (node: ts.Node) => {
      if (
        ts.isNewExpression(node) &&
        ['Error', 'UploadError'].includes(node.expression.getText(source)) &&
        node.arguments?.[0]
      )
        add(node.arguments[0]);
      if (ts.isCallExpression(node)) {
        const name = ts.isPropertyAccessExpression(node.expression)
          ? node.expression.name.text
          : node.expression.getText(source);
        if (
          ['setError', 'setFailure', 'reportError', 'notify', 'sourceMessage'].includes(name) &&
          node.arguments[0]
        )
          add(node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect([...missing]).toEqual([]);
});

test('validation error interpolation preserves authored field names and all named tokens', () => {
  const tokens = (message: string) =>
    [...message.matchAll(/\{\{\w+\}\}/g)].map((match) => match[0]).sort();
  for (const [message, translated] of Object.entries(catalog))
    expect(tokens(translated), message).toEqual(tokens(message));
  expect(catalog['Invalid email or password']).toBe('E-mail ou senha inválidos');
  expect(catalog['Session expired. Re-authenticate to perform this action.']).toContain(
    'sessão expirou',
  );
});
