(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const names = {all:"全部分类",paper:"论文与研究",github:"开源项目",blog:"博客与教程",news:"行业与产品动态",practice:"Skill / MCP 与 AI 实践"};
  const categories=[
    {id:"news",intro:"产品、生态与行业事件。区分官方声明、独立验证与仍待确认的变化。"},
    {id:"paper",intro:"新方法、实验结果与评测。先看结论，再看证据和适用边界。"},
    {id:"github",intro:"值得跟进的稳定版本与工程能力，附升级和试用建议。"},
    {id:"practice",intro:"优先收录可安装、可配置、可测试的 Skill / MCP，并补充有完整证据的 AI coding 与 Agent 工程工作流。"},
    {id:"blog",intro:"可复用的实现经验、教程与深入解读。"}
  ];
  const categoryOf=item=>item.editorial_section==="ai_practice"?"practice":item.type==="product"?"news":item.type;
  const practiceKinds={skill:"Skill",mcp:"MCP",skill_mcp:"Skill + MCP",ai_coding:"AI coding",agent_workflow:"Agent workflow",rag_eval:"RAG / eval"};
  function textMinutes(text) {
    const cjk=(text.match(/[\u3400-\u9fff]/g)||[]).length;
    const words=(text.replace(/[\u3400-\u9fff]/g," ").match(/[a-zA-Z0-9]+/g)||[]).length;
    return cjk/500+words/220;
  }
  function readingEstimate(items,expanded,extraText="") {
    const text=items.map(item=>[item.title,item.summary,item.why_it_matters,
      !expanded||expanded.has(item.item_id)?item.technical_analysis:"",
      item.application].join(" ")).join(" ");
    return Math.max(1,Math.ceil(textMinutes(text+" "+extraText)));
  }
  function chooseAnalysis(items,target) {
    const expanded=new Set();
    if(target<10)return expanded;
    let used=textMinutes(items.map(item=>[item.title,item.summary,item.why_it_matters,item.application].join(" ")).join(" "));
    const grouped=categories.map(category=>items.filter(item=>categoryOf(item)===category.id));
    for(let depth=0;depth<items.length;depth++) {
      for(const group of grouped) {
        const item=group[depth];if(!item)continue;
        const cost=textMinutes(item.technical_analysis||"");
        if(used+cost<=target-0.5){expanded.add(item.item_id);used+=cost;}
      }
    }
    return expanded;
  }
  function el(tag, text, className) {
    const node=document.createElement(tag);
    if(text!==undefined) node.textContent=String(text);
    if(className) node.className=className;
    return node;
  }
  function link(text,url) {
    const node=el("a",text);
    try { const parsed=new URL(url); if(["https:","http:"].includes(parsed.protocol)) node.href=parsed.href; } catch {}
    node.target="_blank";node.rel="noopener noreferrer";return node;
  }
  function paragraph(parent,label,text) {
    if(!text) return;
    parent.append(el("h4",label),el("p",text));
  }
  let activeIssue;
  function render(issue) {
    activeIssue=issue;
    if(issue.schema_version!=="1.0") throw Error("不支持的日报格式");
    const briefing=issue.briefing||{};
    $("date").textContent=issue.issue_date.replaceAll("-"," / ");
    $("day-number").textContent=issue.issue_date.slice(-2);
    $("edition-label").textContent=issue.preview?.label||"每日精编";
    const target=issue.preview?.read_minutes||briefing.read_minutes||15;
    const overviewText=[briefing.headline,briefing.takeaway,...(briefing.actions||[])].join(" ");
    const expanded=chooseAnalysis(issue.items,target-textMinutes(overviewText));
    $("read-time").textContent=issue.items.length+" 篇 · "+target+" 分钟阅读预算 · 本期约 "+readingEstimate(issue.items,expanded,overviewText)+" 分钟";
    if(issue.run_report&&!issue.items.length)$("read-time").textContent="暂无生成条目 · 仅运行报告";
    $("headline").textContent=briefing.headline||"今天，哪些变化值得你关注？";
    $("takeaway").textContent=briefing.takeaway||issue.snapshot_summary||"";
    document.title="Report Daily · "+issue.issue_date;
    $("action-list").replaceChildren();
    for(const action of briefing.actions||[]) $("action-list").append(el("li",action));
    $("actions").hidden=!(briefing.actions||[]).length;
    const unsupported=issue.quality_report?.critic?.unsupported_claims||[];
    const failures=issue.quality_report?.hard_failures||[], warnings=issue.quality_report?.warnings||[];
    const review=$("review-status"), reviewDetails=$("review-details");
    const reviewItems=failures.length?failures:warnings.length?warnings:unsupported;
    review.hidden=!reviewItems.length;review.open=false;reviewDetails.replaceChildren();
    if(reviewItems.length){
      const label=failures.length?"安全检查未通过":warnings.length?"质量提醒":"事实核验建议";
      $("review-summary").textContent=`${label} · ${reviewItems.length} 项`;
      const list=el("ol");
      for(const item of reviewItems) list.append(el("li",item));
      reviewDetails.append(list);
    }else $("review-summary").textContent="";
    const reportBox=$("run-report"), report=issue.run_report;
    document.querySelector(".brief-list").hidden=!!report&&!issue.items.length;
    document.querySelector(".selection-note").hidden=!!report&&!issue.items.length;
    reportBox.replaceChildren();reportBox.hidden=!report;
    if(report){
      const stages={Pending:"准备执行",Collecting:"采集",Enriching:"补全正文",Scoring:"筛选评分",Summarizing:"撰写内容",Validating:"审核/修订",Publishing:"发布",Failed:"失败",Cancelled:"已取消",QualityFailed:"质量门未通过",ReviewIncomplete:"Critic 未完成，可继续审核",ReadyToPublish:"草稿就绪",ReadyForManualPublish:"等待手动发布",Published:"已发布"};
      reportBox.append(el("h2","运行报告"),el("p",`记录状态：${stages[report.status]||report.status} · 已有 ${issue.items.length} 条 / 本次入选 ${report.expected_items||0} 条`),el("p",`最后保存：${new Date(report.updated_at).toLocaleString()}。本页为保存快照，返回运行面板重新打开可刷新。`,"run-report-note"));
      if(report.error)reportBox.append(el("p","失败或中断原因："+report.error,"run-report-error"));
      reportBox.append(el("p","已有内容不因失败而隐藏；未通过审核的内容仅供内部阅读，不会自动发布。","run-report-note"));
      const sources=report.sources||[], candidates=report.candidates||[];
      if(sources.length){const details=el("details");details.append(el("summary",`来源采集记录 · ${sources.length} 个`));const list=el("ul");sources.forEach((source,index)=>{if(typeof source==="string"){list.append(el("li",source||`来源 ${index+1}：未记录详情`));return;}const id=source?.source_id||source?.source||source?.id||`来源 ${index+1}`;const result=source?.error||((source?.count??null)!==null?`获得 ${source.count} 条`:"未记录详情");list.append(el("li",`${id}：${result}`));});details.append(list);reportBox.append(details);}
      const details=el("details");details.open=!issue.items.length;details.append(el("summary",`已保存采集线索 · ${candidates.length} 条（非 AI 总结，最多展示 80 条）`));
      const list=el("ul");for(const candidate of candidates){const row=el("li");row.append(link(candidate.title,candidate.url));list.append(row);}details.append(list);
      if(!candidates.length)details.append(el("p","当前没有保存到采集线索。可在运行日志中查看具体步骤；此页面不会触发付费重试。"));
      reportBox.append(details);
    }
    $("item-count").textContent=issue.items.length+" 篇 / 分类阅读";
    $("stories").replaceChildren();$("contents").replaceChildren();$("filters").replaceChildren();
    const available=categories.filter(c=>issue.items.some(item=>categoryOf(item)===c.id));
    const types=["all",...available.map(c=>c.id)];
    for(const type of types) {
      const total=type==="all"?issue.items.length:issue.items.filter(item=>categoryOf(item)===type).length;
      const button=el("button",(names[type]||type)+" "+total);
      button.setAttribute("aria-pressed",String(type==="all"));
      button.onclick=()=>{
        for(const b of $("filters").children) b.setAttribute("aria-pressed",String(b===button));
        for(const section of $("stories").children) section.hidden=type!=="all"&&section.dataset.type!==type;
      };
      $("filters").append(button);
    }
    const sections=new Map();
    available.forEach((category,index)=>{
      const items=issue.items.filter(item=>categoryOf(item)===category.id);
      const section=el("section",undefined,"category-section");
      section.id="section-"+category.id;section.dataset.type=category.id;
      section.setAttribute("aria-label",names[category.id]);
      const heading=el("div",undefined,"category-heading");
      const title=el("div");title.append(el("span","0"+(index+1)+" / "+items.length+" 篇","eyebrow"),el("h2",names[category.id]));
      heading.append(title,el("span","约 "+readingEstimate(items,expanded)+" 分钟","category-time"));
      section.append(heading,el("p",category.intro,"category-intro"));
      $("stories").append(section);sections.set(category.id,section);
      const jump=el("a",undefined,"category-jump");jump.href="#section-"+category.id;
      jump.append(el("span","0"+(index+1)),el("b",names[category.id]+" · "+items.length+" 篇"));
      jump.onclick=event=>{
        if(hostArchive){event.preventDefault();section.scrollIntoView({behavior:"smooth"});}
        for(const group of $("stories").children) group.hidden=false;
        for(const b of $("filters").children) b.setAttribute("aria-pressed",String(b===$("filters").firstChild));
      };
      $("contents").append(jump);
    });
    const ordered=available.flatMap(c=>issue.items.filter(item=>categoryOf(item)===c.id));
    ordered.forEach((item,index)=>{
      const article=el("article",undefined,"story");article.id="story-"+index;article.dataset.type=categoryOf(item);
      const top=el("div",undefined,"story-topline");
      top.append(el("span",String(index+1).padStart(2,"0"),"story-number"),
                 el("span",names[categoryOf(item)]||item.type,"story-type"),
                 el("span",item.source),
                 el("span",item.published_at ? item.published_at.slice(0,10) : "来源未提供日期"));
      article.append(top,el("h3",item.title),el("p",item.summary,"summary"));
      const practice=item.practice_profile;
      if(item.editorial_section==="ai_practice"&&practice){
        const panel=el("section",undefined,"practice-brief");
        const head=el("div",undefined,"practice-brief-head");
        head.append(el("b",practiceKinds[practice.kind]||"AI 实践"),el("span",`可复现性 ${practice.reproducibility_score}/100`));
        panel.append(head);
        const proof=(practice.proof_points||[])[0];
        if(proof)panel.append(el("p","验证依据："+proof.point));
        if((practice.try_it||[])[0])panel.append(el("p","复现起点："+practice.try_it[0]));
        article.append(panel);
      }
      const why=el("div",undefined,"insight");why.append(el("b","值得关注"),el("p",item.why_it_matters));article.append(why);
      if(expanded.has(item.item_id) && item.technical_analysis) {
        const analysis=el("div",undefined,"extended-analysis");
        analysis.append(el("b","编辑解读"),el("p",item.technical_analysis));article.append(analysis);
      }
      if(item.application) {const action=el("div",undefined,"insight next-step");action.append(el("b","建议行动"),el("p",item.application));article.append(action);}
      const details=el("details");
      const deep=item.deep_dive||[];
      const extraMinutes=Math.max(1,Math.ceil(textMinutes(deep.map(s=>s.content).join(" "))));
      const summary=el("summary");const toggle=el("span","展开 ＋");
      summary.append(el("span",deep.length?"深入详情 · "+deep.length+" 节 · 另读约 "+extraMinutes+" 分钟":"证据与限制 · 暂无扩展详情"),toggle);details.append(summary);
      details.ontoggle=()=>{toggle.textContent=details.open?"收起 −":"展开 ＋";};
      const body=el("div",undefined,"detail-body");
      paragraph(body,"证据范围",item.evidence_note);
      if(practice){
        const practiceDetail=el("section",undefined,"practice-detail");
        practiceDetail.append(el("h4","实践复现卡"));
        practiceDetail.append(el("p",`${practiceKinds[practice.kind]||"AI 实践"} · ${practice.evidence_level==="runnable"?"可运行资产":"详细案例"} · 可复现性 ${practice.reproducibility_score}/100`));
        const appendList=(label,values)=>{if(!values?.length)return;practiceDetail.append(el("h5",label));const list=el("ul");values.forEach(value=>list.append(el("li",typeof value==="string"?value:value.point)));practiceDetail.append(list);};
        appendList("验证依据",practice.proof_points);
        appendList("如何开始",practice.try_it);
        appendList("所需条件",practice.requirements);
        appendList("限制与风险",practice.limitations);
        body.append(practiceDetail);
      }
      if(!expanded.has(item.item_id)) paragraph(body,"编辑解读",item.technical_analysis);
      for(const section of deep) {
        const block=el("section",undefined,"deep-section");
        block.append(el("h4",section.heading));
        for(const p of section.content.split(/\n+/).filter(Boolean))block.append(el("p",p));
        const citations=el("div",undefined,"inline-citations");
        for(const id of section.ref_ids||[]) {
          const ref=(item.sources||[]).find(r=>r.ref_id===id);
          if(ref)citations.append(link("↗ "+(ref.publisher||ref.title),ref.url));
        }
        block.append(citations);body.append(block);
      }
      paragraph(body,"先记住这个限制",item.caveats);
      body.append(el("h4","可追溯事实"));
      const facts=el("ul");for(const fact of item.key_facts||[]) facts.append(el("li",fact.fact));body.append(facts);
      body.append(el("h4","原始来源"));const refs=el("ul");
      for(const ref of item.sources||[]) {const li=el("li");li.append(link(ref.title||ref.url,ref.url));refs.append(li);}
      body.append(refs);details.append(body);article.append(details);
      const sourceLink=link("阅读原始来源 ↗",item.canonical_url);sourceLink.className="source-link";article.append(sourceLink);
      sections.get(categoryOf(item)).append(article);
    });
    $("selection-detail").replaceChildren();
    const stats=issue.source_stats||{};
    $("selection-detail").append(el("p","从 "+(stats.raw_candidates??"—")+" 条采集记录中，先排除过期、修订公告和预发布版本，再由模型按工程价值、信息增量和相关性选出 "+issue.items.length+" 条。采集记录数不等于独立的新资讯数。"));
    $("selection-detail").append(el("p",issue.preview?.method||"主编筛选 → 中文撰稿 → 事实与引用审核。"));
    if(issue.preview) $("selection-detail").append(el("p","内部内容预览；采集时间范围以本期记录为准，不代表已公开发布。"));
    const missing=categories.filter(c=>!sections.has(c.id)).map(c=>names[c.id]);
    if(missing.length) $("selection-detail").append(el("p","本期未收录："+missing.join("、")+"。这不代表该方向没有重要变化，请结合采集覆盖判断。"));
    const coverage=stats.coverage;
    if(coverage) {
      const queries=coverage.discovery?.queries||[];
      $("selection-detail").append(el("h4","采集覆盖与缺口"));
      $("selection-detail").append(el("p","执行搜索 "+queries.filter(q=>q.status==="ok").length+" 次；失败 "+queries.filter(q=>q.status==="failed").length+" 次；预算未执行 "+queries.filter(q=>q.status==="budget_exhausted").length+" 次。"));
      for(const note of coverage.discovery?.limitations||[])$("selection-detail").append(el("p",note));
      for(const [reason,count] of Object.entries(coverage.excluded_reasons||{}))$("selection-detail").append(el("p",reason+"："+count+" 条"));
      $("selection-detail").append(el("p",coverage.scope_note||"覆盖检查不等于热点无遗漏保证。"));
    }
    const practiceStats=stats.practice;
    if(practiceStats?.discovered!=null){
      const qualified=issue.items.filter(item=>item.editorial_section==="ai_practice").length;
      $("selection-detail").append(el("p",`实践发现 ${practiceStats.discovered} 条线索；本期保留 ${qualified} 条通过复现证据筛选的 Skill / MCP 与 AI 工程实践。`));
    }
    $("selection-detail").append(el("p","阅读时长按中文每分钟约 500 字、英文约 220 词估算，统计正文与编辑解读；深入详情和阅读原文另计。"));
    $("selection-detail").append(el("p","所有条目的摘要、意义和行动建议均可直接阅读；重点分析按阅读预算分配展开，其他分析保留在条目详情中。"));
    if(issue.selection_notes?.length) {const notes=el("ul");for(const note of issue.selection_notes) notes.append(el("li",note));$("selection-detail").append(notes);}
  }
  let archive=[],activeKey="",latestIssue=null,localArchive=false,loadGeneration=0,reloadArchive=null,hostArchive=false,embeddedNavigate=null;
  const issueKey=issue=>issue.issue_date+"-r"+issue.revision;
  function showArchive(open) {
    $("archive").hidden=!open;$("archive-button").setAttribute("aria-expanded",String(open));
    if(open){$("archive").scrollIntoView({behavior:"smooth",block:"start"});$("archive-date").focus({preventScroll:true});}
    else $("archive-button").focus({preventScroll:true});
  }
  $("archive-button").onclick=()=>showArchive($("archive").hidden);
  $("archive-close").onclick=()=>showArchive(false);
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!$("archive").hidden)showArchive(false);});
  function renderArchive() {
    $("archive-list").replaceChildren();
    const filtered=archive.filter(entry=>!$("archive-date").value||entry.issue_date===$("archive-date").value);
    $("archive-empty").hidden=filtered.length>0;
    for(const entry of filtered) {
      const li=el("li");const a=el("a");a.href=entry.href;
      a.onclick=event=>{if(hostArchive){event.preventDefault();embeddedNavigate(entry.key);}else if(!localArchive&&location.hash===entry.href){event.preventDefault();reloadArchive?.();}};
      if(entry.key===activeKey)a.setAttribute("aria-current","page");
      a.append(el("b",entry.issue_date+(entry.local?" · 本地预览":" · r"+entry.revision)),
        el("span",entry.title||"每日精编"),
        el("small",(entry.item_count==null?"":entry.item_count+" 条 · ")+(entry.local?entry.label:entry.status||"已发布")+(entry.key===activeKey?" · 正在阅读":"")));
      li.append(a);$("archive-list").append(li);
    }
  }
  $("archive-date").onchange=renderArchive;
  $("archive-clear").onclick=()=>{$("archive-date").value="";renderArchive();};
  function updateNavigation() {
    const index=archive.findIndex(entry=>entry.key===activeKey);
    const buttons=[["issue-prev",archive[index+1]],["issue-next",index>0?archive[index-1]:null],["issue-latest",index!==0?archive[0]:null]];
    for(const [id,entry] of buttons){$(id).disabled=!entry;$(id).onclick=entry?()=>{if(hostArchive)embeddedNavigate(entry.key);else location.href=entry.href;}:null;}
    $("issue-position").textContent=hostArchive?activeIssue.issue_date+" · r"+activeIssue.revision+" · "+(archive[index]?.status||""):localArchive?
      "本地预览 · "+(archive[index]?.label||"")+" · 同日样本分别保留":
      activeIssue.issue_date+" · 修订 r"+activeIssue.revision+(index===0?" · 最新一期":" · 历史归档");
    renderArchive();
  }
  function status(text){$("archive-status").textContent=text;$("archive-status").hidden=!text;}
  async function boot() {
    const embedded=$("embedded-issue");
    if(embedded) {
      localArchive=true;
      render(JSON.parse(embedded.textContent));
      const catalog=JSON.parse($("embedded-archive")?.textContent||'{"entries":[]}');
      if(catalog.mode==="astrbot") {
        hostArchive=true;localArchive=false;
        archive=(catalog.entries||[]).filter(entry=>catalog.issues?.[entry.key]);
        activeKey=catalog.active_key;
        $("archive-note").textContent="AstrBot 内部阅读：最近 30 期（含同日修订版和未发布草稿）。更早的已发布内容可在公开站点查询。";
        const load=key=>{
          if(!catalog.issues[key]){status("未找到这一期，请从历史列表选择。");return;}
          render(catalog.issues[key]);activeKey=key;status("");updateNavigation();showArchive(false);window.scrollTo({top:0});
        };
        embeddedNavigate=load;
        document.querySelector(".wordmark").onclick=event=>{event.preventDefault();load(archive[0].key);};
        load(catalog.active_key);return;
      }
      archive=(catalog.entries||[]).filter(entry=>typeof entry.href==="string"&&/^(?:\.\.\/)?(?:[A-Za-z0-9_.%~-]+\/)?index\.html$/.test(entry.href));
      activeKey=catalog.active_key;
      $("archive-note").textContent="本地样本与正式已发布日报分开保存。同一天的不同预览版本不会冒充不同日期。";
      updateNavigation();
      return;
    }
    const response=await fetch("./data/latest.json",{cache:"no-store"});
    if(!response.ok) throw Error("尚无已发布日报");
    latestIssue=await response.json();render(latestIssue);activeKey=issueKey(latestIssue);
    try {
      const r=await fetch("./data/archive/index.json",{cache:"no-store"});
      if(!r.ok)throw Error("archive unavailable");
      const entries=await r.json();
      archive=entries.filter(entry=>/^\d{4}-\d{2}-\d{2}$/.test(entry.issue_date)&&Number.isInteger(entry.revision)&&entry.revision>0&&entry.path==="data/archive/"+entry.issue_date+"-r"+entry.revision+".json")
        .map(entry=>({...entry,key:entry.issue_date+"-r"+entry.revision,href:"#/"+entry.issue_date+"-r"+entry.revision}));
    } catch {$("archive-note").textContent="历史目录暂不可用，目前只显示已加载的最新一期。重新加载页面可重试。";}
    if(!archive.some(entry=>entry.key===activeKey))archive.push({key:activeKey,issue_date:latestIssue.issue_date,revision:latestIssue.revision,title:latestIssue.briefing?.headline,item_count:latestIssue.items.length,href:"#/"+activeKey});
    archive.sort((a,b)=>b.issue_date.localeCompare(a.issue_date)||b.revision-a.revision);
    updateNavigation();
    async function loadArchive() {
      const key=location.hash.replace(/^#\//,"");
      if(location.hash&&!location.hash.startsWith("#/"))return;
      const generation=++loadGeneration;
      const entry=archive.find(item=>item.key===(key||issueKey(latestIssue)));
      if(!entry){status("未找到这一期日报，请从历史列表重新选择。");return;}
      try {
        let issue=latestIssue;
        if(entry.key!==issueKey(latestIssue)){
          status("正在加载历史日报…");
          const r=await fetch("./"+entry.path);
          if(!r.ok)throw Error("archive load failed");
          issue=await r.json();
          if(issueKey(issue)!==entry.key)throw Error("archive identity mismatch");
        }
        if(generation!==loadGeneration)return;
        render(issue);activeKey=entry.key;status("");updateNavigation();showArchive(false);window.scrollTo({top:0});
      } catch {if(generation===loadGeneration)status("这一期暂时读取失败，当前内容保持不变；可重新选择或返回最新。");}
    }
    reloadArchive=loadArchive;
    window.addEventListener("hashchange",()=>loadArchive());await loadArchive();
  }
  boot().catch(()=>{$("headline").textContent="本期还在编辑中";$("takeaway").textContent="暂无可读取的精编日报。";});
})();
