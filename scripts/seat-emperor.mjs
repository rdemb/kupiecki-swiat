// Local operator command. A public login or chosen character name never grants privileges.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
const [login, uid] = process.argv.slice(2);
if (!process.env.GAME_DATA_DIR || !login || !uid) throw new Error('Podaj GAME_DATA_DIR oraz login i UID istniejącego gracza.');
const db = new DatabaseSync(path.join(process.env.GAME_DATA_DIR, 'game.sqlite'));
const player = db.prepare("SELECT 1 FROM players WHERE username=? AND json_extract(profile,'$.uid')=?").get(login,uid);
if (!player) throw new Error('Login i UID nie wskazują tego samego konta.');
db.prepare('INSERT OR IGNORE INTO emperor(seat,uid) VALUES(1,?)').run(uid);
if (!db.prepare('SELECT 1 FROM emperor WHERE seat=1 AND uid=?').get(uid)) throw new Error('Tron ma już właściciela.');
console.log('Rola Imperatora przypisana do wskazanego konta.');
