// 案件数据：全部为非暴力案件（失窃、破坏、欺诈、误会）。
//
// 位置写法：{ at: 地标key, dx, dz }（相对地标 front 点；无 front 时相对中心），或 { x, z }。
// 运行时会自动把位置挪到附近空地。
//
// 对话行：['npc'|'hero'|'judy'|'nick'|'buddy'|'旁白', 文本]。'hero' = 当前操控的角色，'buddy' = 另一位。
// 选项：{ choices: [{ text, hero?, good?, reply: [...lines] }] }，good=true 的选项才会推进；
//       其余选项播放 reply 后重新出现选项（审讯玩法）。
//
// 任务 step.tasks:
//   { type:'talk', npc, lines, hero?, wrongHero?: lines, gives?: [证据id] }
//   { type:'clue', clue }        调查线索点
//   { type:'deduce', npc }       回到 npc 处进行推理
// 线索 clues[id] = { name, desc, at/x,z, icon, hero?: 'judy'|'nick'（只有该角色能看懂）, wrongHero?: 文本 }
// 证词也会作为证据加入档案：evidence[id] = { name, desc, icon }

export const CASES = [
  // ───────────────────────────── 案件 1 · 教学 ─────────────────────────────
  {
    id: 'donut', title: '消失的甜甜圈', district: '撒瓦纳中央区', difficulty: 1,
    intro: '豹警官本杰明·棒棒腿放在前台的整盒甜甜圈，在他转身接电话的三分钟里不翼而飞。整个 ZPD 第一分局陷入了巨大的“危机”。',
    npcs: {
      clawhauser: { name: '本杰明·棒棒腿', species: 'cheetah', outfit: 'police', at: { at: 'zpd', dx: 3, dz: 2 }, title: 'ZPD 前台警官' },
      sheep: { name: '贝尔维瑟小姐', species: 'sheep', outfit: 'suit', outfitColor: 0x7a5c99, at: { at: 'plaza', dx: 26, dz: -10 }, title: '路过的上班族' },
      duke: { name: '黄鼠狼公爵', species: 'weasel', outfit: 'casual', outfitColor: 0x5b4a3a, at: { at: 'station', dx: 8, dz: 3 }, title: '可疑的小贩' },
      beaver: { name: '小河狸贝丝', species: 'beaver', outfit: 'worker', outfitColor: 0xd9822b, at: { at: 'cityHall', dx: -6, dz: 3 }, title: '快递员' },
    },
    clues: {
      prints: { name: '糖霜爪印', icon: '🐾', at: { at: 'zpd', dx: -12, dz: 4 }, desc: '一串沾着粉色糖霜的小爪印，旁边还有一道扁平、宽大的拖痕——像是一条扁尾巴拖过地面。' },
      slip: { name: '撕下的快递单', icon: '📄', at: { at: 'cityHall', dx: 7, dz: 2 }, desc: '快递单残片：「寄件：ZPD 前台 → 收件：市长办公室」。显然有人把甜甜圈当成了要送的包裹。' },
      wrapper: { name: '盗版碟包装', icon: '💿', at: { at: 'station', dx: -6, dz: 3 }, desc: '一叠《小猪佩奇·狼来了》盗版碟的包装纸。和甜甜圈毫无关系，只能说明有人在这里摆过摊。' },
    },
    evidence: {
      sheepWitness: { name: '路人证词', icon: '🗣️', desc: '贝尔维瑟小姐：看到一个扛着粉色盒子、尾巴扁扁的小家伙，急匆匆往市政厅方向跑。' },
      dukeAlibi: { name: '公爵的不在场证明', icon: '⏱️', desc: '黄鼠狼公爵整个上午都在车站门口卖盗版碟，车站保安可以作证。' },
    },
    suspects: ['duke', 'beaver', 'sheep'],
    solution: { culprit: 'beaver', evidence: ['prints', 'slip', 'sheepWitness'], need: 2 },
    steps: [
      { objective: '和 ZPD 前台的本杰明·棒棒腿谈谈', tasks: [{ type: 'talk', npc: 'clawhauser', lines: [
        ['npc', '朱迪！尼克！出大事了！我的甜甜圈……一整盒！草莓糖霜的！'],
        ['nick', '冷静点，本杰明。又不是你的歌手偶像夏奇羊取消演唱会了。'],
        ['npc', '就三分钟！我转身接了个电话，回来就没了！你们一定要帮我找回来！'],
        ['judy', '别担心，这是我们的第一个案子——呃，今天的第一个。我们先在附近找找线索。'],
        ['旁白', '提示：靠近闪光的线索点按 E 调查。朱迪可以按 Q 使用「敏锐听觉」，显示附近的线索。'],
      ] }] },
      { objective: '在 ZPD 附近寻找线索，并询问广场上的路人', tasks: [
        { type: 'clue', clue: 'prints' },
        { type: 'talk', npc: 'sheep', gives: ['sheepWitness'], lines: [
          ['hero', '您好，ZPD。请问您刚才有没有看到有人拿着一个粉色的盒子？'],
          ['npc', '哦，我正在赶去开会……等等，你是说粉色的甜甜圈盒子？'],
          { choices: [
            { text: '是的，任何细节都很重要。', good: true, reply: [['npc', '我看到一个小个子，尾巴扁扁的，扛着盒子往市政厅那边跑了。他看起来特别着急，像是在赶时间。']] },
            { text: '（尼克）女士，您的毛衣真好看，是新剪的羊毛吗？', hero: 'nick', reply: [['npc', '……谢谢？我真的要迟到了。'], ['judy', '尼克，认真点。']] },
          ] },
        ] },
      ] },
      { objective: '车站门口那个可疑的黄鼠狼……还有市政厅方向。都去看看', tasks: [
        { type: 'talk', npc: 'duke', gives: ['dukeAlibi'], hero: 'nick',
          wrongHero: [['npc', '条子？！我什么都没干！我只是……在这儿呼吸新鲜空气！'], ['旁白', '黄鼠狼公爵一见到警察就不肯开口。也许换尼克来和他“聊聊”。（按 Tab 切换角色）']],
          lines: [
            ['nick', '嘿，公爵。生意不错啊。'],
            ['npc', '王尔德……你现在跟条子混在一起了？'],
            ['nick', '别紧张。我只想知道，今天上午你有没有去过 ZPD 前台？'],
            ['npc', '开什么玩笑！我一整个上午都在这儿卖碟，不信你问车站保安。我会自己跑到警察局门口去偷东西？'],
            ['nick', '有道理。连你都没那么蠢。'],
          ] },
        { type: 'clue', clue: 'wrapper' },
        { type: 'clue', clue: 'slip' },
        { type: 'talk', npc: 'beaver', lines: [
          ['npc', '嗨！我是贝丝，动物城极速快递！今天的单子多得我尾巴都快拖断了！'],
          ['hero', '贝丝，你今天上午有没有去过 ZPD 送件？'],
          ['npc', '去过呀！前台有个盒子，上面贴着要送去市长办公室的单子……不对吗？'],
          ['buddy', '（小声）有意思。'],
        ] },
      ] },
      { objective: '回到 ZPD，向本杰明说明真相（推理）', tasks: [{ type: 'deduce', npc: 'clawhauser' }] },
    ],
    epilogue: [
      ['旁白', '真相大白：前台的快递单被风吹到了甜甜圈盒子上，河狸快递员贝丝认真负责地把它送到了市长办公室。'],
      ['npc', '所以……我的甜甜圈正在市长办公室里？'],
      ['nick', '准确地说，是正在市长的肚子里。'],
      ['npc', '不——！'],
      ['judy', '别难过，贝丝说她会请你吃一整盒新的。顺便，市长也寄了一张道歉卡。'],
      ['旁白', '案件告破！局长牛局长在 ZPD 门口等你们，他有新的案子。'],
    ],
    reward: 100,
  },

  // ───────────────────────────── 案件 2 · 小型啮齿镇 ─────────────────────────────
  {
    id: 'tiara', title: '迷你皇冠失窃案', district: '小型啮齿镇', difficulty: 2,
    intro: '大先生的女儿——小鼩鼱芙芙——定做的婚礼迷你皇冠，在交货前一夜从「小小珠宝行」消失了。现场留下了一颗洋葱球茎，矛头直指惯犯黄鼠狼公爵。',
    npcs: {
      frufru: { name: '芙芙', species: 'shrew', outfit: 'dress', outfitColor: 0xf3a6c8, at: { x: 262, z: 228 }, title: '大先生的女儿' },
      jeweler: { name: '老珠宝匠莫里斯', species: 'mouse', outfit: 'suit', outfitColor: 0x3d3d5c, at: { x: 228, z: 263 }, title: '小小珠宝行老板' },
      raymond: { name: '学徒雷蒙德', species: 'mouse', outfit: 'worker', outfitColor: 0x6b8e5a, at: { x: 248, z: 250 }, title: '珠宝行学徒' },
      guard: { name: '门卫小胡', species: 'mouse', outfit: 'police', at: { x: 248, z: 212 }, title: '啮齿镇门卫' },
      duke: { name: '黄鼠狼公爵', species: 'weasel', outfit: 'casual', outfitColor: 0x5b4a3a, at: { at: 'station', dx: 8, dz: 3 }, title: '惯犯（自称冤枉）' },
      kevin: { name: '凯文', species: 'polarbear', outfit: 'suit', outfitColor: 0x1a1a1a, at: { at: 'mrBig', dx: 6, dz: 4 }, title: '大先生的保镖' },
    },
    clues: {
      glass: { name: '碎玻璃', icon: '🔍', at: { x: 226, z: 264 }, desc: '珠宝行的橱窗玻璃是从里往外碎的——碎片全落在店外的小路上。窃贼是从店内出来的？' },
      bulb: { name: '洋葱球茎', icon: '🧅', at: { x: 244, z: 216 }, hero: 'nick',
        wrongHero: '一颗洋葱球茎……黄鼠狼公爵的标志？朱迪看不出更多门道。也许“老江湖”尼克能看出点什么。',
        desc: '尼克捏了捏：“这是塑料的。公爵偷的可是货真价实的‘午夜狂嚎’花球茎——他从不用假货。有人想嫁祸给他。”' },
      gloves: { name: '沾玻璃粉的小手套', icon: '🧤', at: { x: 252, z: 254 }, desc: '在学徒工具箱旁发现的一副老鼠尺寸的手套，指尖嵌着细小的玻璃碎屑。' },
      ledger: { name: '欠条', icon: '📒', at: { x: 236, z: 248 }, desc: '一张欠条：「雷蒙德欠 "芝士赛车俱乐部" 2,000 元，周五前还清。」' },
    },
    evidence: {
      guardWitness: { name: '门卫证词', icon: '🗣️', desc: '门卫小胡：昨晚啮齿镇大门一直锁着，没有任何大型动物进出——包括黄鼠狼。' },
      dukeAlibi: { name: '公爵的不在场证明', icon: '⏱️', desc: '公爵声称昨晚整夜都在冰川镇大先生庄园“送货”。' },
      kevinConfirm: { name: '保镖的确认', icon: '🐻‍❄️', desc: '凯文确认：公爵昨晚一直在庄园的厨房里剥洋葱，直到天亮。大先生可以作证。' },
    },
    suspects: ['duke', 'raymond', 'jeweler'],
    solution: { culprit: 'raymond', evidence: ['bulb', 'gloves', 'glass', 'ledger', 'guardWitness', 'kevinConfirm'], need: 2 },
    steps: [
      { objective: '进入小型啮齿镇，找到芙芙（小心脚下！）', tasks: [{ type: 'talk', npc: 'frufru', lines: [
        ['npc', '朱迪！哦我的天，你一定要帮我！我的婚礼皇冠不见了！婚礼就在后天！'],
        ['judy', '芙芙，别急，慢慢说。'],
        ['npc', '珠宝行今早发现橱窗碎了，地上还有一颗洋葱球茎！大家都说是那个黄鼠狼干的！爸爸已经气得要把他……呃，冰起来。'],
        ['nick', '冰起来可不行。我们先把事情查清楚。'],
        ['npc', '求你们了！我可不想戴着纸做的皇冠结婚！'],
      ] }] },
      { objective: '调查珠宝行现场，询问老珠宝匠和门卫', tasks: [
        { type: 'clue', clue: 'glass' },
        { type: 'talk', npc: 'jeweler', lines: [
          ['npc', '四十年了，我从没丢过一件首饰。四十年！'],
          ['hero', '昨晚谁最后离开店里？'],
          ['npc', '是我的学徒雷蒙德，他负责锁门。好孩子，就是最近总心不在焉的。'],
        ] },
        { type: 'talk', npc: 'guard', gives: ['guardWitness'], lines: [
          ['npc', '报告警官！昨晚我值夜班，大门一直锁着！'],
          ['hero', '有没有体型比较大的动物——比如黄鼠狼——靠近过？'],
          { choices: [
            { text: '你确定一整晚都没打瞌睡？', good: true, reply: [['npc', '我……我确定！我一晚上喝了三杯芝士拿铁！没有任何大家伙进出，连一只黄鼠狼都没有！']] },
            { text: '（尼克）放松，小家伙，没人会怪你。', hero: 'nick', good: true, reply: [['npc', '呼……好吧。说实话，大门一直锁着，围墙那么高，大家伙根本进不来。']] },
          ] },
        ] },
        { type: 'clue', clue: 'bulb' },
      ] },
      { objective: '去车站找黄鼠狼公爵问话', tasks: [
        { type: 'talk', npc: 'duke', gives: ['dukeAlibi'], hero: 'nick',
          wrongHero: [['npc', '又是你，兔子警官！皇冠不是我偷的！我要见律师！'], ['旁白', '公爵完全不配合。也许尼克更懂得怎么和他说话。']],
          lines: [
            ['nick', '公爵，听说你最近在啮齿镇留了张“名片”？'],
            ['npc', '那颗球茎？哈！我要是真去偷东西，才不会把吃饭的家伙落在现场！'],
            ['npc', '而且昨天晚上我一整夜都在冰川镇大先生的庄园。厨房里有三百斤洋葱等着我剥！'],
            ['nick', '大先生的厨房？那可真是个……让人印象深刻的不在场证明。'],
          ] },
      ] },
      { objective: '前往冰川镇大先生庄园，核实公爵的不在场证明', tasks: [
        { type: 'talk', npc: 'kevin', gives: ['kevinConfirm'], lines: [
          ['npc', '……'],
          ['hero', '我们来核实一件事。黄鼠狼公爵昨晚在这里吗？'],
          ['npc', '在。厨房。剥洋葱。整夜。'],
          ['npc', '大先生说：他剥得很好。眼泪流了一地。'],
          ['nick', '凯文，你今天话真多。'],
        ] },
      ] },
      { objective: '回到啮齿镇，重新搜查学徒雷蒙德的工作区', tasks: [
        { type: 'clue', clue: 'gloves' },
        { type: 'clue', clue: 'ledger' },
        { type: 'talk', npc: 'raymond', lines: [
          ['npc', '警、警官好……还没找到皇冠吗？一定是那个黄鼠狼……'],
          ['hero', '雷蒙德，昨晚是你锁的门？'],
          { choices: [
            { text: '出示证据：沾玻璃粉的手套', good: true, reply: [['npc', '那、那是我切玻璃用的！我是学徒！'], ['judy', '橱窗玻璃是从店里面打破的，碎片全在外面。而门卫说整晚没人进出。'], ['npc', '……']] },
            { text: '你认识黄鼠狼公爵吗？', reply: [['npc', '谁、谁会认识那种家伙！新闻上都是他的照片！']] },
            { text: '（尼克）芝士赛车好玩吗？', hero: 'nick', good: true, reply: [['npc', '你、你怎么知道……'], ['nick', '欠条上写着呢，小子。两千块，周五到期。今天周四。'], ['npc', '……']] },
          ] },
        ] },
      ] },
      { objective: '向芙芙揭晓真相（推理）', tasks: [{ type: 'deduce', npc: 'frufru' }] },
    ],
    epilogue: [
      ['旁白', '雷蒙德欠下了赛车赌债，于是监守自盗，打碎橱窗伪造成外来盗窃，又放了一颗塑料球茎嫁祸给黄鼠狼公爵。'],
      ['npc', '雷蒙德！你怎么能这样！皇冠在哪儿？'],
      ['旁白', '皇冠在雷蒙德的芝士储藏柜里找到了，完好无损。'],
      ['npc', '朱迪，你们是我的英雄！婚礼一定要来！我让爸爸给你们留最好的座位——不，不会把你们冰起来的。'],
      ['nick', '能听到这句话真让人安心。'],
    ],
    reward: 200,
  },

  // ───────────────────────────── 案件 3 · 冰川镇 ─────────────────────────────
  {
    id: 'freezer', title: '冰棍工厂大融化', district: '冰川镇', difficulty: 2,
    intro: '冰川镇冰棍工厂的冷库温度在深夜被调高，三万根爪爪冰棍化成了一地糖水。厂长怀疑是竞争对手搞破坏。',
    npcs: {
      manager: { name: '北极熊厂长柯尔', species: 'polarbear', outfit: 'suit', outfitColor: 0x2e4a62, at: { at: 'iceFactory', dx: 4, dz: 3 }, title: '冰棍工厂厂长' },
      camel: { name: '卡马尔', species: 'camel', outfit: 'suit', outfitColor: 0xc9a227, at: { at: 'tundraPlaza', dx: -8, dz: 3 }, title: '「沙漠冰沙」老板' },
      wolf: { name: '狼保安霍华德', species: 'wolf', outfit: 'police', outfitColor: 0x3f4b5a, at: { at: 'iceFactory', dx: -10, dz: 4 }, title: '夜班保安' },
      wolf2: { name: '狼保安加里', species: 'wolf', outfit: 'police', outfitColor: 0x3f4b5a, at: { at: 'iceFactory', dx: -14, dz: 5 }, title: '保安' },
    },
    clues: {
      sand: { name: '地上的沙子', icon: '🏜️', at: { at: 'iceFactory', dx: 10, dz: 6 }, desc: '冷库门口有一小撮细沙。冰川镇可没有沙子——这东西来自撒哈拉广场。' },
      thermo: { name: '温控器', icon: '🌡️', at: { at: 'iceFactory', dx: -2, dz: 9 }, locked: 'howl',
        lockedText: '控制室门口被狼保安们堵着，他们坚持“厂长没批准不让进”。也许需要尼克想个办法。',
        desc: '温度被调到了「热带模式」。旋钮上缠着几根灰色的长毛——狼毛。' },
      blanket: { name: '通风口旁的毯子', icon: '🧣', at: { at: 'iceFactory', dx: -18, dz: 8 }, desc: '暖风出风口旁铺着一条毯子和一个保温杯，杯子上写着「霍华德」。有人在这里取暖过夜。' },
      memo: { name: '会议备忘录', icon: '📋', at: { at: 'tundraPlaza', dx: -12, dz: 6 }, desc: '「卡马尔 × 冰棍工厂 合作洽谈，周二上午 10 点」。卡马尔昨天来工厂是谈合作的。' },
    },
    evidence: {
      camelStatement: { name: '卡马尔的说法', icon: '🐪', desc: '卡马尔：我昨天来是为了谈联名冰沙的合作，上午十点就走了，鞋里的沙子大概是那时候掉的。' },
      shiftLog: { name: '夜班记录', icon: '📑', desc: '霍华德承认：凌晨三点只有他一人值班。他家的暖气坏了，冷得受不了。' },
    },
    suspects: ['camel', 'wolf', 'manager'],
    solution: { culprit: 'wolf', evidence: ['thermo', 'blanket', 'shiftLog', 'memo', 'camelStatement'], need: 2 },
    steps: [
      { objective: '前往冰川镇冰棍工厂，与厂长谈话', tasks: [{ type: 'talk', npc: 'manager', lines: [
        ['npc', '三万根！三万根爪爪冰棍！全化了！'],
        ['nick', '（小声）我的心在滴血……那可都是我曾经的“货源”啊。'],
        ['npc', '一定是撒哈拉那个开「沙漠冰沙」的骆驼！他昨天还来过厂里，假惺惺地说要谈合作！'],
        ['judy', '我们会查清楚的。请先别下结论。'],
      ] }] },
      { objective: '调查工厂周围', tasks: [
        { type: 'clue', clue: 'sand' },
        { type: 'clue', clue: 'blanket' },
        { type: 'talk', npc: 'wolf2', lines: [
          ['npc', '控制室？不行不行，厂长没批准不让进。'],
          ['hero', '我们是 ZPD，正在调查案子！'],
          ['npc', '规定就是规定。'],
          { choices: [
            { text: '（尼克）……嗷呜——！', hero: 'nick', good: true, reply: [
              ['旁白', '尼克仰起头，发出一声悠长的狼嚎。'],
              ['npc', '……嗷……嗷呜——！！'],
              ['旁白', '工厂里所有的狼都情不自禁地跟着嚎了起来，完全忘了门口还要站岗。'],
              ['nick', '狼就是狼。控制室，请吧，胡萝卜。'],
            ] },
            { text: '出示警徽，强行要求进入。', hero: 'judy', reply: [['npc', '警徽很亮，但规定也很亮。'], ['旁白', '狼保安寸步不让。也许换尼克来试试“别的办法”。']] },
          ] },
        ], unlocks: 'howl' },
      ] },
      { objective: '进入控制室检查温控器', tasks: [{ type: 'clue', clue: 'thermo' }] },
      { objective: '询问骆驼卡马尔和夜班保安霍华德', tasks: [
        { type: 'clue', clue: 'memo' },
        { type: 'talk', npc: 'camel', gives: ['camelStatement'], lines: [
          ['npc', '冰川镇真冷！我的驼峰都要冻成冰淇淋了。'],
          ['hero', '卡马尔先生，昨天您去过冰棍工厂？'],
          ['npc', '去了！我想和他们合作推出「沙漠火焰冰沙」！可那只熊对我很不友好。我十点就走了，在冰川镇再多待一分钟我都受不了！'],
        ] },
        { type: 'talk', npc: 'wolf', gives: ['shiftLog'], lines: [
          ['npc', '我是霍华德，夜班保安。工厂的事我真不知道……'],
          { choices: [
            { text: '温控器上有狼毛，通风口旁有你的保温杯。', good: true, reply: [
              ['npc', '……好吧。我家的暖气坏了三个星期，房东一直不修。值夜班的时候我实在冷得发抖……'],
              ['npc', '我只想把温度调高一点点，暖和一会儿就调回去。结果我裹着毯子……睡着了。'],
            ] },
            { text: '你昨晚有没有看到骆驼？', reply: [['npc', '骆驼？在冰川镇？晚上？没有，绝对没有。']] },
            { text: '（尼克）你看起来很冷啊，霍华德。', hero: 'nick', good: true, reply: [['npc', '冷？我……我一直都很冷。家里暖气坏了……我只是想暖和一会儿……然后睡着了……']] },
          ] },
        ] },
      ] },
      { objective: '向厂长说明真相（推理）', tasks: [{ type: 'deduce', npc: 'manager' }] },
    ],
    epilogue: [
      ['旁白', '没有破坏，也没有阴谋——只是一只冻坏了的狼，和一台坏掉的暖气。'],
      ['npc', '霍华德……你早该告诉我的。工厂有员工宿舍，暖气足得很。'],
      ['npc', '还有……卡马尔先生，我欠您一个道歉。“沙漠火焰冰沙”……我们或许可以谈谈。'],
      ['nick', '看到没，胡萝卜，冰与火的友谊，从一根冰棍开始。'],
      ['judy', '你是不是想在联名款里拿回扣？'],
      ['nick', '我只是想要一个终身免费冰棍卡。'],
    ],
    reward: 250,
  },

  // ───────────────────────────── 案件 4 · 雨林区 ─────────────────────────────
  {
    id: 'rain', title: '雨林停雨之谜', district: '雨林区', difficulty: 3,
    intro: '雨林区的气候控制塔三天没下雨了。叶子发黄，青蛙失业，水獭花店的兰花全都蔫了。有人关掉了喷淋总阀。',
    npcs: {
      otter: { name: '水獭奥特顿太太', species: 'otter', outfit: 'dress', outfitColor: 0x6aa84f, at: { at: 'climateTower', dx: 6, dz: 3 }, title: '花店老板' },
      sloth: { name: '慢慢', species: 'sloth', outfit: 'worker', outfitColor: 0xe0a030, at: { at: 'climateTower', dx: -8, dz: 4 }, title: '气候塔维修工' },
      koala: { name: '考拉老板阿桉', species: 'koala', outfit: 'suit', outfitColor: 0x9a6b3d, at: { at: 'canopyMarket', dx: 5, dz: 3 }, title: '「晴天茶馆」老板' },
      flash: { name: '闪电', species: 'sloth', outfit: 'suit', outfitColor: 0x8fa9c4, at: { at: 'dmv', dx: 3, dz: 2 }, title: '车管所职员' },
      frog: { name: '雨伞摊主', species: 'meerkat', outfit: 'casual', outfitColor: 0x3d85c6, at: { at: 'canopyMarket', dx: -8, dz: 4 }, title: '雨伞小贩' },
    },
    clues: {
      lock: { name: '总阀上的挂锁', icon: '🔒', at: { at: 'climateTower', dx: -2, dz: 8 }, desc: '喷淋总阀被一把崭新的挂锁锁住了，锁上印着「树冠集市·五金铺」的标签。' },
      schedule: { name: '值班表', icon: '🗓️', at: { at: 'climateTower', dx: 12, dz: 6 }, desc: '周一的维修值班人是「慢慢」，但旁边用红笔写着：「慢慢 → 车管所换驾照（预计耗时：全天）」。' },
      poster: { name: '开业海报', icon: '🪧', at: { at: 'canopyMarket', dx: 12, dz: 5 }, desc: '「晴天茶馆·露天平台盛大开业！本周六，阳光普照，不见不散！」——在雨林区承诺“阳光普照”？' },
      keyring: { name: '挂锁收据', icon: '🧾', at: { at: 'canopyMarket', dx: -2, dz: 9 }, hero: 'nick',
        wrongHero: '五金铺柜台下的一堆收据，看起来乱七八糟。尼克也许知道怎么从商家嘴里“套”出买家。',
        desc: '尼克跟五金铺老板东拉西扯了一番：“上周，一位考拉先生买了一把大号挂锁，还问‘能不能锁住水管’。”' },
    },
    evidence: {
      flashAlibi: { name: '车管所记录', icon: '🦥', desc: '闪电（慢慢地）证明：慢慢周一从早上九点到晚上六点都在车管所排队换驾照。' },
      frogTip: { name: '雨伞摊主的抱怨', icon: '☂️', desc: '雨伞小贩：雨一停，我一把伞都卖不掉，倒是对面考拉的茶馆天天客满。' },
    },
    suspects: ['sloth', 'koala', 'frog'],
    solution: { culprit: 'koala', evidence: ['lock', 'keyring', 'poster', 'flashAlibi'], need: 2 },
    steps: [
      { objective: '前往雨林区气候控制塔，与水獭太太谈话', tasks: [{ type: 'talk', npc: 'otter', lines: [
        ['npc', '三天了！整整三天一滴雨都没下！我的兰花，我的蕨类，我的苔藓……'],
        ['judy', '气候塔的维修工呢？'],
        ['npc', '那只树懒？我问他三天了，他还没说完第一句话！'],
      ] }] },
      { objective: '调查气候控制塔', tasks: [
        { type: 'clue', clue: 'lock' },
        { type: 'clue', clue: 'schedule' },
        { type: 'talk', npc: 'sloth', lines: [
          ['npc', '你……………………好……………………'],
          ['nick', '（看表）我们可能需要预留一整个下午。'],
          ['npc', '那……………………把……………………锁……………………不是……………………我的……………………'],
          ['旁白', '慢慢足足用了五分钟说完：周一他不在塔里，他去车管所换驾照了。'],
        ] },
      ] },
      { objective: '去撒瓦纳中央区的车管所，核实慢慢的不在场证明', tasks: [
        { type: 'talk', npc: 'flash', gives: ['flashAlibi'], lines: [
          ['npc', '……………………你…………好…………'],
          ['nick', '闪电！我的老朋友！你知道吗，我有个笑话——'],
          ['judy', '尼克，不行！上次你讲笑话，我们在这里耽误了一个小时！'],
          { choices: [
            { text: '直接问：慢慢周一来过吗？', good: true, reply: [['npc', '…………来…………过…………九点…………到…………六点…………'], ['npc', '…………他…………换完…………驾照…………就…………下班了…………']] },
            { text: '（尼克）一只三个驼峰的骆驼叫什么？', hero: 'nick', reply: [['npc', '…………………………'], ['旁白', '（二十分钟过去了。）'], ['npc', '…………哈…………哈…………哈…………'], ['judy', '尼——克——！']] },
          ] },
        ] },
      ] },
      { objective: '前往树冠集市调查', tasks: [
        { type: 'clue', clue: 'poster' },
        { type: 'clue', clue: 'keyring' },
        { type: 'talk', npc: 'frog', gives: ['frogTip'], lines: [
          ['npc', '雨伞！雨伞！……唉，算了，现在谁还买雨伞。'],
          ['npc', '雨一停，我一把伞都卖不掉，倒是对面那家考拉的茶馆，天天客满。'],
        ] },
        { type: 'talk', npc: 'koala', lines: [
          ['npc', '欢迎光临晴天茶馆！今天阳光真好，来杯桉树叶冰茶吗？'],
          ['hero', '阿桉老板，气候塔停雨，您知道这件事吗？'],
          { choices: [
            { text: '出示证据：五金铺的挂锁收据', good: true, reply: [['npc', '我……我只是想让周六的开业典礼不下雨！就一天！'], ['npc', '雨林区每天都下雨，露天平台根本没法营业……我本来打算开业完就把锁打开的……可钥匙……掉进河里了。']] },
            { text: '您的茶馆生意不错啊。', reply: [['npc', '是呀是呀，最近天气好，大家都喜欢坐在外面！'], ['nick', '“天气好”。在雨林区。']] },
          ] },
        ] },
      ] },
      { objective: '回到气候控制塔，向水獭太太说明真相（推理）', tasks: [{ type: 'deduce', npc: 'otter' }] },
    ],
    epilogue: [
      ['旁白', '为了让露天茶馆开业那天不下雨，考拉阿桉偷偷锁上了气候塔的喷淋总阀——结果钥匙掉进了河里。'],
      ['旁白', '五金铺老板用备用钥匙打开了挂锁。随着一声轰鸣，久违的雨水洒满了整个雨林区。'],
      ['npc', '我的兰花！它们在笑！'],
      ['nick', '阿桉，听我一句——在雨林区开露天茶馆之前，先考虑一下雨棚。'],
      ['judy', '还有，下次想要晴天，可以去撒哈拉广场开分店。'],
    ],
    reward: 300,
  },

  // ───────────────────────────── 案件 5 · 撒哈拉广场 ─────────────────────────────
  {
    id: 'painting', title: '棕榈宫殿的赝品', district: '撒哈拉广场', difficulty: 3,
    intro: '棕榈宫殿酒店大堂的镇店名画《王者之鬃》被发现是一幅赝品。真品价值连城，而酒店的保险理赔申请已经提交了。',
    npcs: {
      manager: { name: '狮子经理里昂', species: 'lion', outfit: 'suit', outfitColor: 0x7a1f2b, at: { at: 'palmHotel', dx: 4, dz: 3 }, title: '酒店总经理' },
      tiger: { name: '老虎门童泰格', species: 'tiger', outfit: 'worker', outfitColor: 0xb22222, at: { at: 'palmHotel', dx: -6, dz: 3 }, title: '酒店门童' },
      critic: { name: '艺评家芭芭拉', species: 'giraffe', outfit: 'dress', outfitColor: 0x2d5f8a, at: { at: 'oasisSpa', dx: 4, dz: 3 }, title: '艺术评论家' },
      artist: { name: '画家咩咩', species: 'sheep', outfit: 'casual', outfitColor: 0xe06666, at: { at: 'bazaar', dx: 4, dz: 3 }, title: '集市画家' },
      broker: { name: '神秘商人', species: 'fox', outfit: 'suit', outfitColor: 0x222222, at: { x: 452, z: 43 }, title: '集市“古董”商' },
    },
    clues: {
      paint: { name: '未干的颜料', icon: '🎨', at: { at: 'palmHotel', dx: 0, dz: 8 }, desc: '画框边缘的颜料还没有完全干透——这幅赝品是最近一周内才画好的。' },
      cart: { name: '保洁推车记录', icon: '🧹', at: { at: 'palmHotel', dx: 10, dz: 6 }, desc: '推车登记表：「周三凌晨 2:00，大堂，经理特批：闭馆保养名画，所有员工回避。」' },
      receipt: { name: '画材收据', icon: '🧾', at: { x: 490, z: 60 }, desc: '集市画材摊的收据：「订制油画临摹一幅，尺寸 3m×2m，买家：L。已付定金。」' },
      catalog: { name: '黑市拍卖目录', icon: '📕', at: { at: 'bazaar', dx: -2, dz: 9 }, hero: 'nick',
        wrongHero: '一个包着牛皮纸的小册子，摊主一看到警察就把它收了起来。',
        desc: '尼克用一个眼神就让摊主把目录递了过来。第 17 号拍品：《王者之鬃》（真迹），委托人：棕榈宫殿“某高层”。' },
    },
    evidence: {
      criticSays: { name: '艺评家的鉴定', icon: '🦒', desc: '芭芭拉：这幅赝品的笔触非常专业，只有拿着真品原样临摹几天才画得出来——画家一定见过真迹。' },
      artistSays: { name: '画家的证词', icon: '🐑', desc: '咩咩：一位“不愿透露姓名的狮子先生”带我去酒店，在闭馆的大堂里临摹了三个晚上。他说是要做一幅“装饰复制品”。' },
      tigerSays: { name: '门童的证词', icon: '🐯', desc: '泰格：经理最近一直在打电话谈“债务”，还让我凌晨两点之后别靠近大堂。' },
    },
    suspects: ['tiger', 'manager', 'artist', 'critic'],
    solution: { culprit: 'manager', evidence: ['cart', 'receipt', 'catalog', 'artistSays', 'tigerSays'], need: 2 },
    steps: [
      { objective: '前往撒哈拉广场的棕榈宫殿酒店', tasks: [{ type: 'talk', npc: 'manager', lines: [
        ['npc', '警官们，感谢你们前来。《王者之鬃》是我们酒店的骄傲……竟然被人调了包！'],
        ['npc', '我怀疑是那只老虎门童。他每天都在大堂，最有机会。'],
        ['nick', '您已经提交保险理赔了？动作真快。'],
        ['npc', '……这是正常流程。'],
      ] }] },
      { objective: '调查酒店大堂，询问门童', tasks: [
        { type: 'clue', clue: 'paint' },
        { type: 'clue', clue: 'cart' },
        { type: 'talk', npc: 'tiger', gives: ['tigerSays'], lines: [
          ['npc', '我？偷画？我连画框都够不着——好吧我够得着。但我没有！'],
          { choices: [
            { text: '最近酒店有什么奇怪的事吗？', good: true, reply: [['npc', '经理最近总是在打电话，声音压得很低，说什么“债务”、“期限”。还特意让我凌晨两点以后别靠近大堂。']] },
            { text: '你凌晨两点在哪？', reply: [['npc', '在员工宿舍睡觉！经理说那晚大堂要“保养”，所有人都不准去！']] },
          ] },
        ] },
      ] },
      { objective: '去绿洲沙浴水疗找艺评家芭芭拉鉴定', tasks: [
        { type: 'talk', npc: 'critic', gives: ['criticSays'], lines: [
          ['npc', '哦，亲爱的，我一眼就看出来了。真迹的鬃毛笔触里有一种……王者的傲慢。赝品只有讨好。'],
          ['npc', '但不得不说，赝品画得很好。画家一定对着真迹临摹了好几天。'],
        ] },
      ] },
      { objective: '去沙丘集市寻找画家和赝品来源', tasks: [
        { type: 'clue', clue: 'receipt' },
        { type: 'clue', clue: 'catalog' },
        { type: 'talk', npc: 'artist', gives: ['artistSays'], lines: [
          ['npc', '咩～欢迎！要画像吗？十分钟一幅！'],
          ['hero', '我们在调查棕榈宫殿的一幅画。'],
          ['npc', '啊……那幅《王者之鬃》？我只是接了一个“装饰复制品”的订单！客户是一位不愿意透露姓名的狮子先生。我在闭馆的大堂里画了三个晚上！我、我什么都不知道！'],
        ] },
      ] },
      { objective: '回到酒店，揭穿真正的调包者（推理）', tasks: [{ type: 'deduce', npc: 'manager' }] },
    ],
    epilogue: [
      ['旁白', '狮子经理欠下巨额债务，于是请画家临摹了一幅赝品，在闭馆夜亲手调包，把真迹送上黑市拍卖，同时向保险公司索赔——想赚两份钱。'],
      ['npc', '……我只是想保住这家酒店。'],
      ['judy', '那就更不应该欺骗信任你的员工，还想把罪名推给泰格。'],
      ['旁白', 'ZPD 在拍卖开始前截获了真迹。《王者之鬃》重新挂回了大堂。'],
      ['nick', '泰格，干得好。下次有人让你凌晨两点别靠近大堂——直接打给我们。'],
    ],
    reward: 350,
  },

  // ───────────────────────────── 案件 6 · 兔窝镇 ─────────────────────────────
  {
    id: 'circles', title: '兔窝镇麦田怪圈', district: '兔窝镇', difficulty: 2,
    intro: '朱迪的老家兔窝镇出现了神秘的田间怪圈，一夜之间还少了二十筐胡萝卜。镇上谣言四起：有人说是外星人，有人说是狐狸吉迪恩。',
    npcs: {
      stu: { name: '斯图·霍普斯', species: 'rabbit', outfit: 'worker', outfitColor: 0x6b8e23, at: { at: 'hoppsFarm', dx: -6, dz: 3 }, title: '朱迪的爸爸' },
      bonnie: { name: '邦妮·霍普斯', species: 'rabbit', outfit: 'dress', outfitColor: 0x9fc5e8, at: { at: 'hoppsFarm', dx: -6, dz: -3 }, title: '朱迪的妈妈' },
      gideon: { name: '吉迪恩·格雷', species: 'fox', outfit: 'worker', outfitColor: 0xf4f4f4, at: { at: 'gideonBakery', dx: 6, dz: 3 }, title: '派店老板' },
      sheep: { name: '羊大叔沙伦', species: 'sheep', outfit: 'worker', outfitColor: 0x8b5a2b, at: { at: 'cropField', dx: -60, dz: -40 }, title: '邻居农夫' },
      kids: { name: '霍普斯家的小兔们', species: 'rabbit', scale: 0.6, outfit: 'casual', outfitColor: 0xffd966, at: { at: 'hoppsFarm', dx: -20, dz: 10 }, title: '朱迪的弟弟妹妹（之一）' },
    },
    clues: {
      tracks: { name: '小小的轮胎印', icon: '🚜', at: { at: 'cropField', dx: -40, dz: -20 }, desc: '怪圈里有一圈圈非常窄的轮胎印——比真正的拖拉机小得多，像是玩具拖拉机留下的。' },
      pie: { name: '咬了一口的蓝莓派', icon: '🥧', at: { at: 'cropField', dx: -30, dz: -30 }, desc: '一块吉迪恩派店的蓝莓派，只被咬了一小口。包装上印着“特价·小朋友专享”。' },
      drawing: { name: '蜡笔画', icon: '🖍️', at: { at: 'hoppsFarm', dx: -26, dz: 6 }, desc: '谷仓里找到一张蜡笔画：「科学课作业：如何证明外星人存在」，画着一个大大的圆圈和一辆小拖拉机，还有很多胡萝卜堆成的“飞碟”。' },
      carrots: { name: '胡萝卜飞碟', icon: '🥕', at: { at: 'hoppsFarm', dx: -34, dz: 12 }, desc: '谷仓后面，二十筐胡萝卜被堆成了一个巨大的“飞碟”模型，还插着手电筒当灯。' },
    },
    evidence: {
      gideonAlibi: { name: '吉迪恩的不在场证明', icon: '🦊', desc: '吉迪恩凌晨三点在店里烤明天的派，店里的烤箱记录和送面粉的货车司机都能证明。' },
      sheepSays: { name: '羊大叔的目击', icon: '🐑', desc: '羊大叔：半夜看到田里有好多小小的手电筒光在转圈，还听到咯咯的笑声。' },
    },
    suspects: ['gideon', 'sheep', 'kids'],
    solution: { culprit: 'kids', evidence: ['tracks', 'drawing', 'carrots', 'sheepSays', 'gideonAlibi'], need: 2 },
    steps: [
      { objective: '回到兔窝镇，和爸爸妈妈打个招呼', tasks: [
        { type: 'talk', npc: 'stu', lines: [
          ['npc', '朱迪！我的宝贝女儿！哦……还有，嗯，狐狸先生。'],
          ['nick', '霍普斯先生。我保证今天不推销任何东西。'],
          ['npc', '你们来得正好！田里出现了怪圈！还少了二十筐胡萝卜！我早就说过……狐狸……呃，我是说，外星人……'],
          ['judy', '爸！'],
        ] },
        { type: 'talk', npc: 'bonnie', lines: [
          ['npc', '朱迪，别听你爸的。镇上有人说是吉迪恩干的，可他现在可是个好孩子，每周都给我们送派。'],
          ['npc', '对了，最近家里的小家伙们特别安静……安静得有点奇怪。'],
        ] },
      ] },
      { objective: '调查东边胡萝卜田的怪圈', tasks: [
        { type: 'clue', clue: 'tracks' },
        { type: 'clue', clue: 'pie' },
        { type: 'talk', npc: 'sheep', gives: ['sheepSays'], lines: [
          ['npc', '外星人！我跟你说，肯定是外星人！'],
          ['hero', '您看到什么了？'],
          ['npc', '半夜里，田里好多小小的光在转圈圈！还有咯咯咯的声音！外星人就是这么笑的！'],
          ['nick', '据我所知，外星人不怎么“咯咯”笑。'],
        ] },
      ] },
      { objective: '去吉迪恩的派店问问', tasks: [
        { type: 'talk', npc: 'gideon', gives: ['gideonAlibi'], lines: [
          ['npc', '朱迪！好久不见！要尝尝新出的蓝莓派吗？'],
          ['hero', '吉迪恩，田里那块派是你店里的。'],
          ['npc', '哎呀，那是“小朋友特价”的！这礼拜好多小兔子来买，一买就是一大堆，说是“搞科学研究的能量补给”。'],
          ['npc', '我？那天凌晨三点我在店里烤派，送面粉的司机可以作证。我现在可是正经生意人。'],
        ] },
      ] },
      { objective: '回霍普斯农场的谷仓看看', tasks: [
        { type: 'clue', clue: 'drawing' },
        { type: 'clue', clue: 'carrots' },
        { type: 'talk', npc: 'kids', lines: [
          ['npc', '朱迪姐姐！我们什么都没干！'],
          ['judy', '嗯哼？'],
          { choices: [
            { text: '出示蜡笔画：“科学课作业”', good: true, reply: [['npc', '……那是我们的作业！老师说要做一个“能证明自己观点的实验”！'], ['npc', '我们想证明外星人存在！所以我们就……做了一个外星人来过的证据……']] },
            { text: '（尼克）孩子们，我也是做“生意”的。我们谈谈？', hero: 'nick', good: true, reply: [['npc', '……你是那个很有名的狐狸警官！'], ['npc', '好吧……我们开着玩具拖拉机在田里画了圈圈，把胡萝卜搬到谷仓后面做了个飞碟……是科学作业！']] },
          ] },
        ] },
      ] },
      { objective: '向爸爸揭晓“外星人”的真相（推理）', tasks: [{ type: 'deduce', npc: 'stu' }] },
    ],
    epilogue: [
      ['旁白', '“外星人”是霍普斯家的二十七只小兔子。他们为了科学作业，用玩具拖拉机在田里画出怪圈，把胡萝卜堆成飞碟。'],
      ['npc', '二十筐胡萝卜……在谷仓后面……做成了飞碟？'],
      ['npc', '……说实话，做得还挺像的。'],
      ['judy', '爸！'],
      ['旁白', '小兔子们的作业得了 A+，题目改成了《如何用证据推翻谣言》。老师特别表扬了“朱迪姐姐和狐狸警官”的协助。'],
      ['nick', '胡萝卜，你家的基因真是……充满想象力。'],
      ['judy', '谢谢，我就当你在夸我了。'],
    ],
    reward: 250,
  },
];

// 牛局长：在 ZPD 门口分配案件
export const BOGO = { name: '牛局长', species: 'buffalo', outfit: 'police', at: { at: 'zpd', dx: -4, dz: 2 }, title: 'ZPD 局长' };
