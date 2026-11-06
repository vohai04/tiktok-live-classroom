// Separate oral-test bank; the shared deck persists these IDs just like class questions.
const task=(a,operator,b,result)=>({kind:'stage',subject:'toan',text:`Trả bài: ${a} ${operator} ${b} = ?`,options:[result,result-4,result+3,result+7].map(String),correct:0,explain:`${a} ${operator} ${b} = ${result}.`});
module.exports=Array.from({length:40},(_,i)=>task(21+i,'+',9+i*7%20,30+i+i*7%20))
  .concat(Array.from({length:40},(_,i)=>task(63+i,'−',8+i*3%23,55+i-i*3%23)))
  .concat(Array.from({length:40},(_,i)=>task(11+Math.floor(i/8),'×',3+i%8,(11+Math.floor(i/8))*(3+i%8))));
