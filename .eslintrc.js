module.exports = {
	"env": {
		"es2022": true,
		"node": true
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"requireConfigFile": false,
		"sourceType": "module"
	},
	"rules": {
		"no-unused-vars": ["error", {"args": "none"}],
		"eqeqeq": ["error", "always"],
		"no-useless-return": "error",
		"no-trailing-spaces": "error"
	}
};
