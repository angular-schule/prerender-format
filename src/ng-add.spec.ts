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

  it('swaps the builder and enables flat output, keeping all other options', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app() }));

    await ngAdd({ project: 'site' })(tree, mockContext);

    expect(buildTarget(tree, 'site')).toEqual({
      builder: BUILDER_NAME,
      options: { outputMode: 'static', prerenderOutputStyle: 'flat' }
    });
    expect(mockLogger.warn).not.toHaveBeenCalled();
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

  it('warns if outputMode is not static', async () => {
    const tree = Tree.empty();
    tree.create('angular.json', angularJson({ site: app(undefined, { outputMode: 'server' }) }));

    await ngAdd({ project: 'site' })(tree, mockContext);

    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('"outputMode": "static"'));
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
