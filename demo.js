import { projectUrl, publishableKey } from './config.js';
const sample = () => ({
  clients: [{id:1,name:'Juniper Design',work:'Verify file-share access'},{id:2,name:'Harbor Workshop',work:'Document workstation setup'}],
  tickets: [{id:1,client:1,title:'Review access to shared folders',status:'Open',created:Date.now()-3600000,responded:null}],
  sessions: [], running: null
});
let state = sample();
let database;
let ownerId;
let saving = false;
let lastSaved = sample();
let current = 'Overview';
const names = ['Overview','Clients','Tickets','Timeclock','SLAs'];
const view = document.querySelector('#view');
const navigation = document.querySelector('#navigation');
const notice = document.querySelector('#notice');
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}
async function save(message) {
  saving = true;
  notice.textContent = 'Saving to Supabase…';
  try {
    const { error } = await database.from('hq_demo_workspace').upsert({ owner_id: ownerId, state });
    if (error) throw error;
    lastSaved = structuredClone(state);
    notice.textContent = message + ' Saved to Supabase.';
  } catch {
    state = structuredClone(lastSaved);
    notice.textContent = 'Supabase could not save the change. Please try again.';
  } finally {
    saving = false;
    render();
  }
}
function table(headers, rows) {
  return rows.length ? '<div class="scroll"><table><thead><tr>'+headers.map(header=>'<th>'+header+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>' : '<p>No entries yet.</p>';
}
function clientName(id) { return escapeHtml(state.clients.find(client => client.id === id)?.name || 'Unassigned'); }
function duration(ms) {
  const seconds=Math.floor(Math.max(0,ms)/1000);
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(part=>String(part).padStart(2,'0')).join(':');
}
function render() {
  navigation.innerHTML = names.map(name=>'<button data-view="'+name+'" aria-pressed="'+(name===current)+'">'+name+'</button>').join('');
  if(current==='Overview') {
    const stats=[['Clients',state.clients.length],['Open tickets',state.tickets.filter(ticket=>ticket.status==='Open').length],['Time logged',duration(state.sessions.reduce((total,session)=>total+session.elapsed,0))]];
    view.innerHTML='<div class="stats">'+stats.map(([label,value])=>'<article>'+label+'<strong>'+value+'</strong></article>').join('')+'</div><section><h2>Try the workflow</h2><p>Create a ticket from a client, log time against it, and record the first response in SLAs.</p><button class="primary" data-open="Clients">Open clients</button></section>';
  }
  if(current==='Clients') view.innerHTML='<section><h2>Client spreadsheet</h2>'+table(['Client','Current work','Action'],state.clients.map(client=>[escapeHtml(client.name),escapeHtml(client.work),'<button data-create="'+client.id+'">Create ticket</button>']))+'</section>';
  if(current==='Tickets') view.innerHTML='<section><h2>Business tickets</h2>'+table(['Ticket','Client','Status','Action'],state.tickets.map(ticket=>['#'+ticket.id+' '+escapeHtml(ticket.title),clientName(ticket.client),ticket.status,ticket.status==='Open'?'<button data-close="'+ticket.id+'">Mark done</button>':'']))+'</section>';
  if(current==='Timeclock') view.innerHTML='<section><h2>Timeclock</h2>'+(state.running?'<p id="clock"></p><button data-stop>Stop timer</button>':'<form><label>Ticket<select name="ticket" required>'+state.tickets.map(ticket=>'<option value="'+ticket.id+'">#'+ticket.id+' '+escapeHtml(ticket.title)+'</option>').join('')+'</select></label><button class="primary">Start timer</button></form>')+'</section><section><h2>Time log</h2>'+table(['Ticket','Duration'],state.sessions.map(session=>['#'+session.ticket,duration(session.elapsed)]))+'</section>';
  if(current==='SLAs') view.innerHTML='<section><h2>First-response SLA</h2><p>Sample target of four elapsed hours from ticket creation.</p>'+table(['Ticket','Due','Status','Action'],state.tickets.map(ticket=>{
    const deadline=ticket.created+14400000;
    const status=ticket.responded?(ticket.responded<=deadline?'Met':'Missed'):(Date.now()>deadline?'Overdue':'Open');
    return ['#'+ticket.id+' '+escapeHtml(ticket.title),escapeHtml(new Date(deadline).toLocaleString()),status,ticket.responded?'':'<button data-respond="'+ticket.id+'">Record response</button>'];
  }))+'</section>';
  tick();
}
function tick(){const clock=document.querySelector('#clock');if(clock && state.running) clock.textContent='Ticket #'+state.running.ticket+' · '+duration(Date.now()-state.running.started);}
navigation.addEventListener('click',event=>{if(event.target.dataset.view){current=event.target.dataset.view;render();}});
view.addEventListener('click',event=>{
  if (!database || saving) return;
  const data=event.target.dataset;
  if(data.open){current=data.open;render();}
  if(data.create){
    const client=state.clients.find(item=>item.id===Number(data.create));
    if(!client) return;
    const id=Math.max(0,...state.tickets.map(ticket=>ticket.id))+1;
    state.tickets.push({id,client:client.id,title:client.work,status:'Open',created:Date.now(),responded:null});
    current='Tickets';save('Created ticket #'+id+'.');
  }
  if(data.close){state.tickets.find(ticket=>ticket.id===Number(data.close)).status='Done';save('Ticket marked done.');}
  if(data.respond){state.tickets.find(ticket=>ticket.id===Number(data.respond)).responded=Date.now();save('Response recorded.');}
  if('stop' in data && state.running){state.sessions.push({ticket:state.running.ticket,elapsed:Date.now()-state.running.started});state.running=null;save('Time logged.');}
});
view.addEventListener('submit',event=>{
  event.preventDefault();
  if (!database || saving) return;
  const id=Number(new FormData(event.target).get('ticket'));
  if(!state.running && state.tickets.some(ticket=>ticket.id===id)){state.running={ticket:id,started:Date.now()};save('Timer started.');}
});
document.querySelector('#reset').addEventListener('click',()=>{if (!database || saving) return;state=sample();current='Overview';save('Sample data reset.');});
setInterval(tick, 1000);
async function load() {
  document.querySelector('#reset').disabled = true;
  if (!projectUrl || !publishableKey) {
    notice.textContent = 'Supabase connection settings are required.';
    return;
  }
  notice.textContent = 'Connecting to Supabase…';
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.78.0/+esm');
    const client = createClient(projectUrl, publishableKey, {
      auth: { storageKey: 'renvytra-hq-demo-auth', detectSessionInUrl: false }
    });
    let { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (!session) {
      const result = await client.auth.signInAnonymously();
      if (result.error) throw result.error;
      session = result.data.session;
    }
    if (!session?.user?.is_anonymous) throw new Error('Expected an anonymous demo session.');
    ownerId = session.user.id;
    const { data, error: readError } = await client.from('hq_demo_workspace').select('state').eq('owner_id', ownerId).maybeSingle();
    if (readError) throw readError;
    if (data) state = data.state;
    else {
      const { error: seedError } = await client.from('hq_demo_workspace').upsert({ owner_id: ownerId, state }, { ignoreDuplicates: true });
      if (seedError) throw seedError;
    }
    lastSaved = structuredClone(state);
    database = client;
    document.querySelector('#reset').disabled = false;
    notice.textContent = 'Connected to Supabase.';
    render();
  } catch {
    notice.textContent = 'The demo could not connect to Supabase. Reload to try again.';
  }
}
void load();
