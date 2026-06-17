const fs = require('fs');
const Babel = require('@babel/standalone');

const code = fs.readFileSync('index.html', 'utf8');
const scriptContent = code.match(/<script type="text\/babel">([\s\S]*?)<\/script>/)[1];

try {
  Babel.transform(scriptContent, { presets: ['env', 'react'] });
  console.log('Success!');
} catch (e) {
  console.error(e);
}
