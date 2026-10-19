// Unsigned input sets the clock; a leading +/- adjusts the server's current time.
export function parseClockInput(input){
 const match=/^([+-]?)(\d{1,3}):([0-5]\d)$/.exec(String(input).trim().replace(/[−－]/g,'-').replace(/＋/g,'+'));
 if(!match)throw Error('请输入 mm:ss；减时间用 -00:10，加时间用 +00:10，例如设置为 45:00');
 const seconds=Number(match[2])*60+Number(match[3]);
 return match[1]?{deltaSeconds:(match[1]==='-'?-1:1)*seconds}:{seconds};
}
