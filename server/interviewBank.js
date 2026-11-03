const topics = {
  Java: { concepts: ['JVM', 'class', 'object', 'inheritance', 'interface', 'exception', 'collection', 'garbage collection'], items: [
    ['What does the JVM do when running a Java program?', 'The JVM loads and verifies bytecode, then executes it and manages runtime services such as memory and garbage collection.', ['bytecode','execute','memory']],
    ['How do an interface and an abstract class differ?', 'An interface defines a contract that classes can implement; an abstract class can also hold shared state and implemented behavior.', ['contract','implement','shared','state']],
    ['When would you choose a List over a Set?', 'A List preserves order and allows duplicates; a Set enforces uniqueness and is useful for membership checks.', ['order','duplicates','unique']],
  ]},
  Python: { concepts: ['list', 'tuple', 'dictionary', 'mutable', 'immutable', 'iterator', 'exception', 'GIL'], items: [
    ['When would you use a tuple instead of a list?', 'Use a tuple for an ordered collection that should not change; lists are mutable and suited to changing collections.', ['ordered','immutable','mutable']],
    ['What is a Python dictionary?', 'A dictionary maps unique hashable keys to values and provides efficient key-based lookup.', ['key','value','lookup']],
    ['What is an iterator?', 'An iterator returns values one at a time through the iterator protocol, usually with __iter__ and __next__.', ['one at a time','iter','next']],
  ]},
  JavaScript: { concepts: ['event loop', 'promise', 'async/await', 'closure', 'scope', 'DOM', 'prototype', 'type coercion'], items: [
    ['How does the JavaScript event loop handle asynchronous work?', 'Synchronous code runs on the call stack; queued callbacks run when the stack is clear, while promise jobs use the microtask queue.', ['call stack','queue','microtask']],
    ['What is a closure?', 'A closure is a function together with access to variables from its lexical scope, even after the outer function returns.', ['function','scope','variables']],
    ['How do async and await relate to promises?', 'An async function returns a promise; await pauses that function until the promise settles, without blocking the main thread.', ['promise','await','non-block']],
  ]},
  C: { concepts: ['pointer', 'memory', 'stack', 'heap', 'array', 'struct', 'malloc', 'undefined behavior'], items: [
    ['What is a pointer in C?', 'A pointer stores the memory address of an object or function; its type describes what it points to.', ['address','memory','type']],
    ['How do stack and heap allocation differ?', 'Automatic local objects usually have block lifetime on the stack; heap memory is requested dynamically and must be managed by the program.', ['automatic','dynamic','free','lifetime']],
    ['What can cause a buffer overflow?', 'Writing beyond an array’s bounds can corrupt adjacent memory and cause undefined behavior; validate lengths and use bounded operations.', ['bounds','array','undefined','validate']],
  ]},
  'C++': { concepts: ['RAII', 'pointer', 'reference', 'class', 'template', 'STL', 'smart pointer', 'move semantics'], items: [
    ['Explain RAII in C++.', 'RAII ties resource ownership to object lifetime: constructors acquire resources and destructors release them, including during exceptions.', ['resource','lifetime','constructor','destructor']],
    ['When should you use a unique_ptr?', 'Use unique_ptr for exclusive ownership; it automatically releases the object and can transfer ownership with move semantics.', ['exclusive','ownership','automatic','move']],
    ['What is the purpose of move semantics?', 'Move semantics transfer a resource from a temporary or expiring object instead of copying its contents.', ['transfer','resource','copy']],
  ]},
  HTML: { concepts: ['semantic element', 'DOM', 'form', 'accessibility', 'attribute', 'document structure'], items: [
    ['Why use semantic HTML elements?', 'Semantic elements communicate document structure and meaning to browsers, assistive technology, and maintainers.', ['meaning','structure','assistive']],
    ['How do you make a form control accessible?', 'Associate a visible label with the control, preserve keyboard operation, and expose validation and errors clearly.', ['label','keyboard','validation']],
    ['What is the DOM?', 'The DOM is the browser’s object representation of a document, which scripts can inspect and update.', ['object','document','update']],
  ]},
  CSS: { concepts: ['cascade', 'specificity', 'box model', 'flexbox', 'grid', 'responsive design'], items: [
    ['How does CSS specificity affect the cascade?', 'When declarations conflict, origin and importance are considered first, then specificity and source order determine the winning declaration.', ['specificity','order','cascade']],
    ['What does box-sizing: border-box change?', 'It includes padding and border in the declared width and height, making element sizing easier to reason about.', ['padding','border','width']],
    ['When would you choose Grid over Flexbox?', 'Grid is suited to two-dimensional row and column layouts; Flexbox is suited to arranging items along one axis.', ['two-dimensional','rows','columns','one axis']],
  ]},
  React: { concepts: ['component', 'props', 'state', 'render', 'effect', 'key', 'controlled input', 'reconciliation'], items: [
    ['How do props and state differ in React?', 'Props are inputs passed by a parent; state is data owned by a component that can change and trigger a render.', ['props','parent','state','render']],
    ['Why do list items need stable keys?', 'Keys let React match items between renders so it can update, insert, or remove the correct elements.', ['match','renders','update','stable']],
    ['When should an effect be used?', 'Use an effect to synchronize a component with an external system, such as a subscription or browser API; keep derived render data out of effects.', ['external','synchronize','subscription']],
  ]},
  'Node.js': { concepts: ['event loop', 'non-blocking I/O', 'stream', 'middleware', 'error handling', 'module'], items: [
    ['What does non-blocking I/O mean in Node.js?', 'I/O operations can be started without waiting synchronously; completion is handled later through callbacks, promises, or events.', ['without waiting','asynchronous','callback','promise']],
    ['When are streams useful?', 'Streams process data incrementally, which limits memory use for large files or network transfers.', ['incrementally','memory','large']],
    ['What is Express middleware?', 'Middleware is a function in the request-response pipeline that can inspect or change the request, response, or pass control onward.', ['request','response','next','pipeline']],
  ]},
  SQL: { concepts: ['join', 'index', 'transaction', 'normalization', 'group by', 'constraint'], items: [
    ['What is the difference between INNER JOIN and LEFT JOIN?', 'INNER JOIN returns matching rows; LEFT JOIN preserves every left-side row and fills missing right-side columns with NULL.', ['matching','left','null']],
    ['Why can an index improve a query and also hurt writes?', 'An index can speed lookups by avoiding scans, but it consumes storage and must be maintained on inserts, updates, and deletes.', ['lookup','scan','storage','write']],
    ['What does ACID describe?', 'ACID describes transaction properties: atomicity, consistency, isolation, and durability.', ['atomicity','consistency','isolation','durability']],
  ]},
  MongoDB: { concepts: ['document', 'collection', 'BSON', 'index', 'aggregation', 'replica set'], items: [
    ['How does a MongoDB document differ from a relational row?', 'A document stores structured fields in BSON and can contain nested values; related documents are grouped in collections.', ['document','BSON','nested','collection']],
    ['When should you add a MongoDB index?', 'Add an index for frequent filter, sort, or join patterns after measuring queries; indexes use storage and add write cost.', ['query','sort','storage','write']],
    ['What is an aggregation pipeline?', 'It processes documents through ordered stages such as match, group, project, and sort to calculate results.', ['stages','match','group','project']],
  ]},
  'Data Structures': { concepts: ['array', 'linked list', 'stack', 'queue', 'hash table', 'tree', 'graph', 'complexity'], items: [
    ['When is a hash table a good choice?', 'Use a hash table for average constant-time key lookup when keys are hashable and ordering is not the main requirement.', ['key','lookup','constant','hash']],
    ['How do a stack and a queue differ?', 'A stack is last-in, first-out; a queue is first-in, first-out.', ['last-in','first-out','queue','stack']],
    ['What trade-offs distinguish arrays and linked lists?', 'Arrays provide indexed access and locality; linked lists support node insertion after a known position but require traversal for indexing.', ['indexed','access','insertion','traversal']],
  ]},
  Algorithms: { concepts: ['time complexity', 'space complexity', 'sorting', 'search', 'recursion', 'dynamic programming', 'greedy'], items: [
    ['What does Big O notation describe?', 'Big O describes an asymptotic upper bound on how an algorithm’s resource use grows with input size.', ['growth','input size','upper bound']],
    ['When is binary search applicable?', 'Binary search applies when the search space is ordered or can be partitioned consistently; each step discards about half.', ['ordered','half','search space']],
    ['How does dynamic programming avoid repeated work?', 'It stores results of overlapping subproblems and reuses them, often with memoization or a bottom-up table.', ['subproblems','stores','reuse','memoization']],
  ]},
  'Computer Networks': { concepts: ['TCP', 'UDP', 'DNS', 'HTTP', 'TLS', 'IP', 'latency', 'packet'], items: [
    ['How do TCP and UDP differ?', 'TCP provides an ordered reliable byte stream with connection management; UDP sends datagrams without those delivery guarantees.', ['reliable','ordered','datagram','connection']],
    ['What happens during a DNS lookup?', 'A resolver finds the address record for a name, using cache or querying DNS servers through the hierarchy.', ['resolver','address','cache','servers']],
    ['What does TLS provide for HTTPS?', 'TLS authenticates the server and protects data in transit using encryption and integrity checks.', ['authenticate','encryption','integrity','transit']],
  ]},
  'Operating Systems': { concepts: ['process', 'thread', 'scheduler', 'virtual memory', 'mutex', 'deadlock', 'system call'], items: [
    ['How does a process differ from a thread?', 'A process has its own address space and resources; threads share process resources while having separate execution state.', ['address space','resources','share','execution']],
    ['What is virtual memory?', 'Virtual memory maps process addresses to physical memory and storage, providing isolation and an abstraction of a larger address space.', ['addresses','physical','isolation','mapping']],
    ['What conditions can cause deadlock?', 'Deadlock requires mutual exclusion, hold-and-wait, no preemption, and circular wait; breaking one condition can prevent it.', ['mutual exclusion','hold','preemption','circular']],
  ]},
  DBMS: { concepts: ['normalization', 'primary key', 'foreign key', 'transaction', 'ACID', 'isolation', 'index'], items: [
    ['Why normalize a relational schema?', 'Normalization reduces duplicate facts and update anomalies by organizing attributes according to dependencies.', ['duplicate','anomalies','dependencies']],
    ['What is a foreign key?', 'A foreign key constrains values in one table to reference a candidate or primary key in another table, supporting referential integrity.', ['references','table','integrity']],
    ['What does transaction isolation control?', 'Isolation controls how concurrent transactions observe one another’s intermediate and committed changes.', ['concurrent','transactions','changes']],
  ]},
  aptitude: { concepts: ['ratio', 'percentage', 'average', 'rate', 'estimation', 'units'], items: [
    ['A value rises from 80 to 100. What is the percentage increase?', 'The increase is 20; divide by the original 80 and multiply by 100, giving 25%.', ['20','80','25']],
    ['A car travels 150 km in 3 hours. What is its average speed?', 'Average speed is distance divided by time: 150 / 3 = 50 km/h.', ['distance','time','50']],
    ['How would you estimate 19% of 250?', 'Compute 20% of 250 as 50, then subtract 1% of 250 (2.5), giving 47.5.', ['20%','50','2.5','47.5']],
  ]},
  'logical reasoning': { concepts: ['assumption', 'deduction', 'pattern', 'evidence', 'necessary condition', 'counterexample'], items: [
    ['How do you test whether a conclusion follows from premises?', 'Identify what the premises guarantee, then check whether a counterexample can satisfy all premises while making the conclusion false.', ['premises','counterexample','conclusion']],
    ['What is the next number in 2, 6, 12, 20, 30?', 'The differences are 4, 6, 8, and 10, so the next difference is 12 and the next number is 42.', ['differences','12','42']],
    ['How do you distinguish correlation from causation?', 'Correlation is an observed association; causal claims need a design or evidence that rules out confounding and alternative explanations.', ['association','causal','confounding','evidence']],
  ]},
  'HR/behavioral': { concepts: ['STAR method', 'specific example', 'ownership', 'reflection', 'impact', 'communication'], items: [
    ['Tell me about a time you handled a disagreement on a team.', 'There is no single factual answer. Use STAR: describe the situation and task, the action you took to listen and resolve it, and the result you achieved.', ['situation','task','action','result']],
    ['Describe a mistake and what you learned from it.', 'There is no single factual answer. Own a specific mistake, explain its impact, the corrective action, and what you changed afterward.', ['mistake','impact','action','learned']],
    ['Why are you interested in this role?', 'There is no single factual answer. Connect a truthful skill or experience to the role’s responsibilities and explain the contribution you hope to make.', ['skill','experience','role','contribution']],
  ]},
};

const topicNames = Object.keys(topics);
function buildQuestions(topic, difficulty) {
  const data = topics[topic];
  if (!data) return null;
  const technical = data.items.map(([question, expectedAnswer, keywords], index) => ({
    type: 'Technical', question: `${question}${difficulty === 'Advanced' ? ' Include trade-offs or edge cases where relevant.' : difficulty === 'Beginner' ? ' Explain it in clear, simple terms.' : ''}`,
    expectedAnswer, explanation: expectedAnswer, keywords, category: topic, level: difficulty,
  }));
  const behavioral = topic === 'HR/behavioral';
  const questions = [...technical, {
    type: 'Scenario', category: topic, level: difficulty,
    question: `A ${topic} problem is causing a blocker in a ${difficulty.toLowerCase()}-level task. How would you investigate it, choose a solution, and verify the result?`,
    expectedAnswer: `Clarify the expected behavior, reproduce and isolate the issue, use relevant ${topic} concepts to compare options, apply a focused fix, and verify with a suitable test. Explain trade-offs and the result.`,
    explanation: 'A strong scenario response states the goal, gathers evidence, explains the decision, and verifies the outcome.',
    keywords: ['clarify', 'reproduce', 'evidence', 'solution', 'test', 'result'],
  }, {
    type: 'Behavioral', category: topic, level: difficulty,
    question: behavioral ? 'Tell me about a time you learned a difficult concept and applied it.' : 'Tell me about a time you used or learned something related to this topic to solve a problem.',
    expectedAnswer: 'Answers vary. Give an honest example using STAR: Situation, Task, Action, and Result. Explain your own contribution and what you learned.',
    explanation: 'Behavioral answers are personal, not fact-matched. A clear STAR structure makes the example specific and easy to follow.',
    keywords: ['situation', 'task', 'action', 'result'],
  }];
  return questions;
}

function evaluateAnswer(question, answer) {
  const normalized = String(answer || '').toLowerCase();
  const keywords = question.keywords || [];
  const matched = keywords.filter(word => normalized.includes(word.toLowerCase()));
  const words = normalized.trim().split(/\s+/).filter(Boolean).length;
  const sentences = normalized.split(/[.!?]+/).filter(Boolean).length;
  const conceptScore = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 50;
  const correctness = Math.min(100, Math.round(conceptScore * 0.8 + (words >= 10 ? 20 : words * 2)));
  const relevance = Math.min(100, Math.round(45 + Math.min(words, 65) * 0.45 + matched.length * 3));
  const completeness = Math.min(100, Math.round(35 + Math.min(words, 80) * 0.35 + matched.length * 4));
  const grammar = Math.min(100, Math.round(55 + Math.min(sentences, 4) * 8 + (/[.!?]$/.test(answer.trim()) ? 10 : 0)));
  const clarity = Math.min(100, Math.round(48 + Math.min(sentences, 4) * 8 + (words >= 12 ? 12 : 0)));
  const average = Math.round((correctness + relevance + completeness + grammar + clarity) / 5);
  const behavioral = question.type === 'Behavioral';
  const feedback = behavioral
    ? (matched.length >= 3 ? 'Your response includes several STAR elements. Make the outcome and your personal contribution explicit.' : 'Behavioral answers are personal; use a specific example and structure it as Situation, Task, Action, and Result.')
    : matched.length >= Math.ceil(keywords.length * 0.6)
      ? 'Your answer covers several expected concepts. Compare it with the reference answer and add a concrete example or trade-off.'
      : 'Some expected concepts were missing from your answer. Review the reference answer below, then explain the key idea in your own words.';
  const strength = matched.length ? `You addressed: ${matched.slice(0, 4).join(', ')}.` : words >= 10 ? 'You gave enough detail to identify your reasoning.' : 'You started with a direct response.';
  const missing = keywords.filter(word => !matched.includes(word));
  const improvement = missing.length ? `Consider covering: ${missing.slice(0, 4).join(', ')}. Then add a specific example.` : 'Add a specific example and state how you verified the result.';
  return {
    scores: { correctness, relevance, completeness, grammar, clarity },
    score: average, feedback, strength, improvement,
    evaluationMethod: 'local-topic-question-bank',
    matchedConcepts: matched,
    note: behavioral ? 'Behavioral answers are assessed for structure, not a single correct personal story.' : 'Local rubric matches answer concepts against this question’s reference keywords; it is a study aid, not semantic or expert grading.',
  };
}

module.exports = { topicNames, buildQuestions, evaluateAnswer };
