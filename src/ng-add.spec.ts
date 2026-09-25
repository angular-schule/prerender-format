import { SchematicContext, Tree } from '@angular-devkit/schematics';

import { BUILDER_NAME, ngAdd } from './ng-add';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  log: vi.fn(),
  createChild: vi.fn()
};

const mockContext = { logger: mockLogger } as unknown as SchematicContext;

function angularJson(projects: Record<string, object>) {
  return JSON.stringify({ version: 1, projects });
}

function app(builder = '@angular/build:application', options: object = { outputMode: 'static' }) {
  return {
    projectType: 'application',
    root: '',
    architect: { build: { builder, options } }
  };
}

function buildTarget(tree: Tree, project: string) {
  const json = JSON.parse(tree.read('angular.json')?.toString() ?? '{}');
  return json.projects[project].architect.build;
}

describe('ng-add', () => {
  beforeEach(() => vi.clearAllMocks());

  it('swaps the builder and enables the "file" format, keeping all other options', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app() }));

    await ngAdd({ project: 'site' })(tree, mockContext);

    expect(buildTarget(tree, 'site')).toEqual({
      builder: BUILDER_NAME,
      options: { outputMode: 'static', prerenderFormat: 'file' }
    });
  });

  it('selects the only project automatically', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app() }));

    await ngAdd({ project: '' })(tree, mockContext);

    expect(buildTarget(tree, 'site').builder).toBe(BUILDER_NAME);
  });

  it('is idempotent', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app() }));

    await ngAdd({ project: 'site' })(tree, mockContext);
    await ngAdd({ project: 'site' })(tree, mockContext);

    expect(buildTarget(tree, 'site').builder).toBe(BUILDER_NAME);
  });

  it('refuses a build that ships a server (outputMode server)', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app(undefined, { outputMode: 'server' }) }));

    await expect(ngAdd({ project: 'site' })(tree, mockContext)).rejects.toThrow(
      /ships an Angular SSR server \(options\)/
    );
  });

  it('refuses legacy SSR without outputMode', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app(undefined, { ssr: true, server: 'src/main.server.ts' }) }));

    await expect(ngAdd({ project: 'site' })(tree, mockContext)).rejects.toThrow(/ships an Angular SSR server/);
  });

  it('refuses a configuration that switches to outputMode server', async () => {
    const tree = Tree.empty();
    const site = app();
    Object.assign(site.architect.build, { configurations: { production: { outputMode: 'server' } } });
    tree.create('angular.json', angularJson({ site }));

    await expect(ngAdd({ project: 'site' })(tree, mockContext)).rejects.toThrow(
      /configuration "production"/
    );
  });

  it('accepts a static build with an SSR entry and legacy prerendering without server', async () => {
    const tree = Tree.empty();
    tree.create(
      'angular.json',
      angularJson({
        a: app(undefined, { outputMode: 'static', ssr: { entry: 'src/server.ts' } }),
        b: app(undefined, { prerender: true })
      })
    );

    await ngAdd({ project: 'a' })(tree, mockContext);
    await ngAdd({ project: 'b' })(tree, mockContext);

    expect(buildTarget(tree, 'a').builder).toBe(BUILDER_NAME);
    expect(buildTarget(tree, 'b').builder).toBe(BUILDER_NAME);
  });

  it('requires a project name if there are several projects', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ a: app(), b: app() }));

    await expect(ngAdd({ project: '' })(tree, mockContext)).rejects.toThrow(/--project/);
  });

  it('refuses a build target with another builder', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app('@angular-devkit/build-angular:browser') }));

    await expect(ngAdd({ project: 'site' })(tree, mockContext)).rejects.toThrow(
      /replaces "@angular\/build:application" only/
    );
  });

  it('refuses a project without build target', async () => {
    const tree = Tree.empty();
    tree.create(
      'angular.json',
      angularJson({ site: { projectType: 'application', root: '', architect: {} } })
    );

    await expect(ngAdd({ project: 'site' })(tree, mockContext)).rejects.toThrow(/Cannot find build target/);
  });
});
