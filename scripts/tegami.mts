import { tegami } from 'tegami';
import { runCli } from 'tegami/cli';
import { github } from 'tegami/plugins/github';

const paper = tegami({
	plugins: [
		github({
			repo: 'tobynguyen27/oxlint-plugin-case-police',
			versionPr: {
				base: 'main',
			},
		}),
	],
	npm: {
		trustedPublish: {
			provider: 'github',
			workflow: 'release.yml',
		},
	},
});

await runCli(paper);
