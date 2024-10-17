import globals from "globals";
import js from "@eslint/js";

export default [
	js.configs.recommended,

	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
		},

		rules: {
			"no-unused-vars": ["error", {
				args: "none",
			}],

			eqeqeq: ["error", "always"],
			"no-useless-return": "error",
			"no-trailing-spaces": "error",
		},
	},

	{
		files: ["**/*.mjs"],

		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},

	{
		files: ["**/*.js"],

		languageOptions: {
			globals: {
				...globals.browser,
				...globals.jquery,
				bootstrap: "readonly",
			},
		},
	}
];
