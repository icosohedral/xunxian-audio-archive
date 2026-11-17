export const THEME_STORAGE_KEY = "xunxian-color-theme";

/** Inlined in <head> so the saved theme applies before first paint. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=document.documentElement;if(t==="orange"||t==="dark")d.dataset.theme="orange";if(t==="dark")d.dataset.mode="dark";}catch(e){}`;
