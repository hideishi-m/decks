module.exports = {
    "env": {
        "browser": true,
        "jquery": true
    },
	"globals": {
		"bootstrap": "readonly",
		"utils": "readonly"
	},
    "extends": "eslint:recommended",
	"parser": "/usr/local/lib/node_modules/kusanagi-prem3/node_modules/@babel/eslint-parser",
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
