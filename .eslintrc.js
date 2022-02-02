module.exports = {
	"env": {
		"es2021": true,
		"node": true
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"requireConfigFile": false,
		"ecmaVersion": 12
	},
	"rules": {
		"no-unused-vars": ["error", {"args": "none"}],
		"eqeqeq": ["error", "always"],
		"no-useless-return": "error",
		"no-trailing-spaces": "error"
	}
};
