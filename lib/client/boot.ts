/** Runs before first paint (inlined in the root layout) so text size and motion never jump. */
export const SETTINGS_BOOT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("vb.settings")||"{}"),h=document.documentElement;if(s.textSize==="large"||s.textSize==="largest")h.setAttribute("data-text-size",s.textSize);if(s.motion==="reduce")h.setAttribute("data-motion","reduce")}catch(e){}`;
