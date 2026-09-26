import { workspaces } from '@angular-devkit/core';
import { SchematicContext, SchematicsException, Tree } from '@angular-devkit/schematics';

import { shipsServer } from './application/ships-server';
import { createHost } from './utils';

interface NgAddOptions {
  project: string;
}

export const BUILDER_NAME = '@angular-schule/prerender-format:application';
const ANGULAR_BUILDER_NAME = '@angular/build:application';

export const ngAdd = (options: NgAddOptions) => async (tree: Tree, context: SchematicContext) => {
  const host = createHost(tree);
  const { workspace } = await workspaces.readWorkspace('/', host);

  if (!options.project) {
    if (workspace.projects.size === 1) {
      // If there is only one project, return that one.
      options.project = Array.from(workspace.projects.keys())[0];
    } else {
      throw new SchematicsException(
        'There is more than one project in your workspace. Please select it manually by using the --project argument.'
      );
    }
  }

  const project = workspace.projects.get(options.project);
  if (!project) {
    throw new SchematicsException('The specified Angular project is not defined in this workspace');
  }

  if (project.extensions.projectType !== 'application') {
    throw new SchematicsException(
      `@angular-schule/prerender-format requires an Angular project type of "application" in angular.json`
    );
  }

  const buildTarget = project.targets.get('build');
  if (!buildTarget) {
    throw new SchematicsException(
      `Cannot find build target for the Angular project "${options.project}" in angular.json.`
    );
  }

  if (buildTarget.builder !== ANGULAR_BUILDER_NAME && buildTarget.builder !== BUILDER_NAME) {
    throw new SchematicsException(
      `The build target of "${options.project}" uses "${buildTarget.builder}". ` +
        `@angular-schule/prerender-format replaces "${ANGULAR_BUILDER_NAME}" only.`
    );
  }

  const configurationsWithServer = [
    ['options', buildTarget.options ?? {}] as const,
    ...Object.entries(buildTarget.configurations ?? {}).map(
      ([name, configuration]) =>
        [`configuration "${name}"`, { ...buildTarget.options, ...configuration }] as const
    )
  ]
    .filter(([, options]) => shipsServer(options))
    .map(([name]) => name);

  buildTarget.builder = BUILDER_NAME;
  buildTarget.options = { ...buildTarget.options, prerenderFormat: 'file' };

  await workspaces.writeWorkspace(workspace, host);

  context.logger.info('');
  context.logger.info('🚀 @angular-schule/prerender-format is ready!');
  context.logger.info('');
  if (configurationsWithServer.length) {
    context.logger.warn(
      `⚠️  The build target of "${options.project}" produces a server (${configurationsWithServer.join(', ')}). ` +
        `There, prerenderFormat "file" is not considered and routes stay '<route>/index.html'. ` +
        `Use "outputMode": "static" to get '<route>.html'.`
    );
    context.logger.info('');
  }
  context.logger.info('Next steps:');
  context.logger.info('  1. Make sure your host serves foo.html under /foo without a redirect.');
  context.logger.info('  2. Build via: ng build');
  context.logger.info('  3. Have a nice day!');

  return tree;
};
