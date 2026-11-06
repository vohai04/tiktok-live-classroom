'use strict';
document.getElementById('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=document.getElementById('loginButton'),error=document.getElementById('error');
  button.disabled=true;error.textContent='';
  try{
    const res=await fetch('/api/classroom/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('password').value})});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Không đăng nhập được.');
    location.replace('/admin');
  }catch(err){error.textContent=err.message;}finally{button.disabled=false;}
});
