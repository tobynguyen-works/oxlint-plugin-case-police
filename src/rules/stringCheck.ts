import { distDir } from '@/dirs';
import type { RuleOption } from '@/types';
import { defineRule, type ESTree, type Rule } from '@oxlint/plugins';
import { replaceCore } from 'case-police';
import { join } from 'pathe';
import { createSyncFn } from 'synckit';

const loadDict = createSyncFn<(options: RuleOption) => Promise<Record<string, string>>>(
	join(distDir, 'worker.mjs'),
);

const defaultOptions = {
	noDefault: false,
	dict: {},
	presets: [],
	ignore: [],
} satisfies Required<RuleOption>;

export const stringCheck: Rule = defineRule({
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Make the case correct in string',
			recommended: true,
		},
		messages: {
			casePoliceError: '{{ from }} should be {{ to }}',
		},
		fixable: 'code',
		hasSuggestions: false,
		schema: [
			{
				type: 'object',
				additionalProperties: false,
				properties: {
					dict: {
						description: 'Custom dictionary, will be merged with original dict.',
						type: 'object',
						default: {},
					},
					noDefault: {
						description: 'Disable the default dictionary.',
						type: 'boolean',
						default: false,
					},
					presets: {
						description: 'Filter the default presets.',
						type: 'array',
						default: [],
					},
					ignore: {
						description: 'Ignore some words.',
						type: 'array',
						default: [],
					},
				},
			},
		],
		defaultOptions: [defaultOptions],
		deprecated: false,
	},
	createOnce(context) {
		let options: RuleOption;
		let dict: Record<string, string>;
		let sourceCode: string;

		let cachedOptionsString: string | null = null;

		const checkText = (node: ESTree.Node) => {
			const [start, end] = node.range;

			const originalStr = sourceCode.slice(start, end);
			const outputs: { from: string; to: string; index: number }[] = [];

			replaceCore(originalStr, dict, options.ignore, (_, index, from, to) => {
				outputs.push({ index, from, to });
			});

			for (const { from, to, index } of outputs) {
				const lines = originalStr.slice(0, index).split('\n');
				const loc = {
					line: node.loc.start.line + lines.length - 1,
					column:
						lines.length === 1
							? node.loc.start.column + lines[0].length
							: lines.at(-1)!.length,
				};

				context.report({
					messageId: 'casePoliceError',
					data: { from, to },
					node,
					*fix(fixer) {
						yield fixer.replaceTextRange(
							[start + index, start + index + from.length],
							to,
						);
					},
					loc: {
						start: loc,
						end: {
							line: loc.line,
							column: loc.column + from.length,
						},
					},
				});
			}
		};

		return {
			before() {
				options = {
					...defaultOptions,
					...(context.options?.[0] as RuleOption),
				};

				sourceCode = context.sourceCode.text;

				const currentOptionsString = JSON.stringify(options);

				if (currentOptionsString !== cachedOptionsString) {
					dict = loadDict(options);
					cachedOptionsString = currentOptionsString;
				}
			},
			Literal(node) {
				if (typeof node.value === 'string') checkText(node);
			},
			JSXText: checkText,
			TemplateElement: checkText,
		};
	},
});
