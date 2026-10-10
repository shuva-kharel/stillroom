import postcss from 'postcss';
import {readFile,writeFile} from 'node:fs/promises';
// One authoritative room layout replaces accumulated desktop/mobile overrides.
const classes=['app','upgraded-room','room','rail','rail-main','rail-bottom','rail-monogram','brand-mark','nav-button','topbar','topbar-actions','wordmark','local-status','workspace','room-heading','room-date','timer-workspace','timer-topline','subject-select','subject-label','subject-dot','mode-tabs','room-mode-switcher','intention','timer-controls','start-button','cycle-row','room-bottom','today-summary','summary-icon','sound-card','sound-toggle','sound-card-label','sound-state','sound-bars','workspace-footer','room-personalization-strip','scene-shortcut','companion','companion-heading','desk-note','companion-footer','desktop-panel-control','mobile-panel-control','personalize-button','focus-button','study-experience','resume-row','resume-button','study-action-row','next-step','wrap-up'];
const pattern=new RegExp('\\.('+classes.filter(x=>x!=='upgraded-room').join('|')+')(?![\\w-])');
for(const file of ['src/styles.css','src/studio.css','src/study.css']){
 const root=postcss.parse(await readFile(file,'utf8'));root.walkRules(rule=>{if(rule.parent?.type==='atrule'&&rule.parent.name.includes('keyframes'))return;const selectors=rule.selectors.filter(selector=>!pattern.test(selector));if(!selectors.length)rule.remove();else rule.selectors=selectors;});
 root.walkAtRules(rule=>{if(rule.nodes&&!rule.nodes.length)rule.remove()});
 await writeFile(file,root.toString());
}
