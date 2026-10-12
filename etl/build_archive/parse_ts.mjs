// 解析 web/content 下的 .ts 数据文件（纯数据）→ JSON
// 用法: node etl/build_archive/parse_ts.mjs <ts文件> <导出名>
import { readFileSync } from 'fs';

const [,, file, exportName] = process.argv;
let src = readFileSync(file, 'utf-8');
// 去掉 import / interface {...} / type X = ...;  块
src = src.replace(/^\s*import\s+.*?;?\s*$/gm, '');
src = src.replace(/\binterface\s+\w+\s*\{[\s\S]*?\}/g, '');
src = src.replace(/\btype\s+\w+\s*=[\s\S]*?;/g, '');
src = src.replace(/\bexport\s+/g, '');
// 去掉变量类型注解  变量: Type =   （含 X[] 和 Record<...>、联合、对象）
src = src.replace(/(\b\w+)\s*:\s*(?:Record<[^;=]*?>|[A-Za-z][\w<>\[\]|' ]*?)(?=\s*=)/g, '$1');
// 截断函数声明（数据文件里可能带辅助函数）
src = src.replace(/\bfunction\s+\w+\s*\([\s\S]*$/, '');
// 求值
const fn = new Function(src + `\nreturn ${exportName};`);
process.stdout.write(JSON.stringify(fn()));
