const url = 'https://plane.n-compass.online/api/v1/workspaces/ntv-development/projects/de83ad37-e07c-49ec-b1c2-6be20e64feb2/work-items/';
const key = process.env.PLANE_API_KEY;
fetch(url, {
    headers: { 'X-Api-Key': key }
}).then(res => console.log(res.status)).catch(err => console.error(err));
