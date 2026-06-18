// 预置字体样式数据（软件自带，不存储在数据库中）

export interface FontStyleCategory {
  id: string;
  category_id: string;
  name: string;
  icon?: string;
  sort_order: number;
}

export interface FontStyle {
  id: string;
  style_id: string;
  category_id: string;
  name: string;
  prompt: string;
  thumbnail: string;
}

export const FONT_CATEGORIES: FontStyleCategory[] = [
  { id: '1', category_id: 'fashion', name: '时尚体', icon: 'Sparkles', sort_order: 1 },
  { id: '2', category_id: 'minimal', name: '极简无衬线体', icon: 'Square', sort_order: 2 },
  { id: '3', category_id: 'thin', name: '细线体', icon: 'Minus', sort_order: 3 },
  { id: '4', category_id: 'singleLine', name: '单线字体', icon: 'Hash', sort_order: 4 },
  { id: '5', category_id: 'serif', name: '现代衬线体', icon: 'Type', sort_order: 5 },
  { id: '6', category_id: 'handwritten', name: '极简手写体', icon: 'PenTool', sort_order: 6 },
  { id: '7', category_id: 'curved', name: '弯曲字体', icon: 'CornerDownRight', sort_order: 7 },
  { id: '8', category_id: 'handdrawn', name: '手绘字体', icon: 'Pencil', sort_order: 8 },
  { id: '9', category_id: 'graffiti', name: '涂鸦字体', icon: 'Flame', sort_order: 9 },
  { id: '10', category_id: 'art', name: '艺术字体', icon: 'Palette', sort_order: 10 },
  { id: '11', category_id: 'exaggerated', name: '夸张体', icon: 'Zap', sort_order: 11 },
  { id: '12', category_id: 'futuristic', name: '未来感字体', icon: 'Rocket', sort_order: 12 },
  { id: '13', category_id: 'funny', name: '趣味变形体', icon: 'Smile', sort_order: 13 },
  { id: '14', category_id: 'pixel', name: '像素风格体', icon: 'Grid3X3', sort_order: 14 },
  { id: '15', category_id: 'vintage', name: '复古字体', icon: 'Clock', sort_order: 15 },
  { id: '16', category_id: 'gothic', name: '哥特风格字体', icon: 'Castle', sort_order: 16 },
  { id: '17', category_id: 'brush', name: '毛笔字', icon: 'Feather', sort_order: 17 },
  { id: '18', category_id: 'western', name: '西部手写字体', icon: 'CowboyHat', sort_order: 18 },
  { id: '19', category_id: 'chinese', name: '国潮体', icon: 'Sun', sort_order: 19 },
  { id: '20', category_id: 'kids', name: '童趣商业字体', icon: 'Baby', sort_order: 20 },
  { id: '21', category_id: 'signboard', name: '城市商业招牌体', icon: 'Store', sort_order: 21 },
];

export const FONT_STYLES: FontStyle[] = [
  // 时尚体
  { id: '1', style_id: 'fashion-1', category_id: 'fashion', name: '潮流品牌字', prompt: '"时尚达人"，时尚体，字形前卫，线条简洁流畅，笔画利落，结构紧凑，整体有现代潮牌感。', thumbnail: '1时尚体/1潮流品牌字.png' },
  { id: '2', style_id: 'fashion-2', category_id: 'fashion', name: '高级杂志字', prompt: '"高级玩家"，时尚体，字形修长，笔画干净，字距舒展，结构优雅，整体像时尚杂志标题。', thumbnail: '1时尚体/2高级杂志字.png' },
  { id: '3', style_id: 'fashion-3', category_id: 'fashion', name: '都市潮流字', prompt: '"都市潮流"，时尚体，字形宽扁低重心，笔画横向延展，线条硬朗平直，结构紧密有节奏感，整体像现代城市潮流视觉标题。', thumbnail: '1时尚体/3都市潮流字.png' },
  { id: '4', style_id: 'fashion-4', category_id: 'fashion', name: '先锋设计字', prompt: '"先锋设计"，时尚体，字形结构大胆重组，局部笔画夸张变形，线条简洁但张力强，整体像实验性设计展海报标题。', thumbnail: '1时尚体/4先锋设计字.png' },
  // 极简无衬线体
  { id: '5', style_id: 'minimal-1', category_id: 'minimal', name: '极简品牌字', prompt: '"极简品牌"，极简品牌体，字形方正厚重，笔画粗细完全统一，横竖比例均衡，结构紧密稳定，字距克制，整体像高端品牌 Logo。', thumbnail: '2极简无衬线体/5极简品牌字.png' },
  { id: '6', style_id: 'minimal-2', category_id: 'minimal', name: '现代知识字', prompt: '"现代知识"，知识标题体，字形端正清晰，笔画中等偏细，横竖线条干净利落，结构开放有序，字距舒展，整体像知识专栏或课程封面标题。', thumbnail: '2极简无衬线体/6现代知识字.png' },
  { id: '7', style_id: 'minimal-3', category_id: 'minimal', name: '清爽标题字', prompt: '"如沐春风"，清爽留白体，字形轻盈舒展，笔画细而均匀，线条柔和干净，字距大幅拉开，结构松弛有呼吸感，整体安静、清爽。', thumbnail: '2极简无衬线体/7清爽标题字.png' },
  { id: '8', style_id: 'minimal-4', category_id: 'minimal', name: '科技简洁字', prompt: '"智能工作流"，几何科技体，字形模块化，笔画平直硬朗，横竖转角接近直角，结构规整像科技产品 UI 标题，整体理性、系统、数字化。', thumbnail: '2极简无衬线体/8科技简洁字.png' },
  // 细线体
  { id: '9', style_id: 'thin-1', category_id: 'thin', name: '轻奢细线字', prompt: '"时间复利"，轻奢细线体，字形高挑窄长，竖向比例明显拉伸，横画短而克制，竖画细长挺拔，笔画带极轻微粗细变化，末端收笔精致干净，字距适中，整体像高级香水、珠宝品牌标题。', thumbnail: '3细线体/9轻奢细线字.png' },
  { id: '10', style_id: 'thin-2', category_id: 'thin', name: '温柔细线字', prompt: '"慢慢变好"，温柔细线体，笔画纤细柔和，线条带轻微自然弧度，字形舒展松弛，重心平稳，整体安静、温柔、像生活方式杂志标题。', thumbnail: '3细线体/10温柔细线字.png' },
  { id: '11', style_id: 'thin-3', category_id: 'thin', name: '高级知识字', prompt: '"深度观察"，理性细线体，字形端正方阔，横竖线条清晰笔直，笔画细而有秩序，转折干净，结构开放，字距均衡，整体像深度知识专栏或研究报告标题。', thumbnail: '3细线体/11高级知识字.png' },
  { id: '12', style_id: 'thin-4', category_id: 'thin', name: '未来细线字', prompt: '"智能边界"，未来细线体，字形几何化，笔画纤细平直，横竖转角接近直角，局部笔画呈模块断开式连接，结构轻盈但精密，整体像未来科技界面的系统标题。', thumbnail: '3细线体/12未来细线字.png' },
  // 单线字体
  { id: '13', style_id: 'singleLine-1', category_id: 'singleLine', name: '连续线稿体', prompt: '"纤线灵动"，连续线稿体，字形由一根连续线条勾勒而成，线条粗细一致，转折流畅自然，笔画之间有连贯路径感，结构轻盈清晰，整体像极简线稿艺术标题。', thumbnail: '4单线字体/13连续线稿体.png' },
  { id: '14', style_id: 'singleLine-2', category_id: 'singleLine', name: '草图单线体', prompt: '"灵感草图"，草图单线体，字形像设计师手稿中的快速线条，笔画细而自然，线条带轻微抖动和手绘停顿，结构松弛但可读，整体像创意草图标题。', thumbnail: '4单线字体/14草图单线体.png' },
  { id: '15', style_id: 'singleLine-3', category_id: 'singleLine', name: '科技线框字', prompt: '"连接万物"，科技线框体，字形由细直线和几何折线组成，笔画像线框结构搭建而成，横竖转角清晰，局部有节点式连接感，整体像科技网络界面的标题字体。', thumbnail: '4单线字体/15科技线框字.png' },
  { id: '16', style_id: 'singleLine-4', category_id: 'singleLine', name: '优雅单线字', prompt: '"留白之美"，优雅单线体，字形修长舒展，笔画由细长单线构成，横画克制，竖画挺拔，转折柔和，字距宽松，整体像高级展览海报中的极简标题。', thumbnail: '4单线字体/16优雅单线字.png' },
  // 现代衬线体
  { id: '17', style_id: 'serif-1', category_id: 'serif', name: '杂志衬线体', prompt: '"都市韵律"，杂志衬线体，字形修长挺拔，笔画有明显粗细对比，横画纤细，竖画有力度，衬线短小利落，字距舒展，整体像高端时尚杂志标题。', thumbnail: '5现代衬线体/17杂志衬线体.png' },
  { id: '18', style_id: 'serif-2', category_id: 'serif', name: '商业衬线体', prompt: '"增长模型"，现代衬线体，结构稳定，笔画利落，衬线克制，整体专业、商业、可信。', thumbnail: '5现代衬线体/18商业衬线体.png' },
  { id: '19', style_id: 'serif-3', category_id: 'serif', name: '轻奢封面字', prompt: '"高阶审美"，轻奢衬线体，字形高挑纤长，横画极细，竖画优雅挺拔，衬线精致尖细，收笔干净，字距略宽，整体像珠宝、香水或高定品牌标题。', thumbnail: '5现代衬线体/19轻奢封面字.png' },
  { id: '20', style_id: 'serif-4', category_id: 'serif', name: '深度专栏字', prompt: '"深度观察"，专栏衬线体，字形方正端庄，笔画粗细分明，结构严肃有序，衬线短直稳定，字距均衡，整体像思想评论、财经专栏或深度报道标题。', thumbnail: '5现代衬线体/20深度专栏字.png' },
  // 极简手写体
  { id: '21', style_id: 'handwritten-1', category_id: 'handwritten', name: '清新手迹字', prompt: '"清新手迹"，清新手迹体，字形轻盈自然，笔画细而流畅，线条像中性笔随手写下，结构简洁不复杂，字距舒展，整体干净、清爽、像生活杂志里的手写标题。', thumbnail: '6极简手写体/21清新手迹字.png' },
  { id: '22', style_id: 'handwritten-2', category_id: 'handwritten', name: '成长笔记字', prompt: '"慢慢变好"，成长笔记体，字形柔和松弛，笔画带轻微粗细变化，横竖转折自然，结构像笔记本里的认真手写标题，整体温柔、真实、有自我成长记录感。', thumbnail: '6极简手写体/22成长笔记字.png' },
  { id: '23', style_id: 'handwritten-3', category_id: 'handwritten', name: '个人签名字', prompt: '"自由开工"，个人签名体，字形连贯流动，笔画起伏明显，部分笔画自然相连，尾笔轻微拉长，整体像个人品牌签名，松弛但有识别度。', thumbnail: '6极简手写体/23个人签名字.png' },
  { id: '24', style_id: 'handwritten-4', category_id: 'handwritten', name: '情绪手写字', prompt: '"别急着稳定"，情绪手写体，字形轻微倾斜，笔画带速度感，线条有自然抖动和停顿，结构松动但清晰，整体像情绪很满时写下的一句手写标题。', thumbnail: '6极简手写体/24情绪手写字.png' },
  // 弯曲字体
  { id: '25', style_id: 'curved-1', category_id: 'curved', name: '柔和曲线字', prompt: '"信手拈来"，柔和曲线体，字形由大量圆润曲线构成，笔画转折柔顺，线条像丝带一样自然弯折，结构舒展流畅，整体温和、轻盈、有柔软动感。', thumbnail: '7弯曲字体/25柔和曲线字.png' },
  { id: '26', style_id: 'curved-2', category_id: 'curved', name: '女性美学字', prompt: '"自在生长"，女性美学体，字形纤长柔美，笔画带优雅弧线，横竖转折自然收放，结构舒展不紧绷，整体像女性生活方式杂志中的柔美标题。', thumbnail: '7弯曲字体/26女性美学字.png' },
  { id: '27', style_id: 'curved-3', category_id: 'curved', name: '音乐律动字', prompt: '"旋律流动"，音乐律动体，字形带明显波浪节奏，笔画像音符和声波一样起伏延展，线条流动感强，结构有节拍变化，整体像音乐海报标题。', thumbnail: '7弯曲字体/27音乐律动字.png' },
  { id: '28', style_id: 'curved-4', category_id: 'curved', name: '艺术曲线字', prompt: '"曲线之间"，艺术曲线体，字形由夸张曲线和不对称弧线重组，笔画弯折幅度明显，结构富有实验性但保持可读，整体像艺术展览海报中的曲线字体。', thumbnail: '7弯曲字体/28艺术曲线字.png' },
  // 手绘字体
  { id: '29', style_id: 'handdrawn-1', category_id: 'handdrawn', name: '轮廓手绘体', prompt: '"栩栩如生"，轮廓手绘体，字形由手工勾勒的外轮廓组成，笔画像被一笔一笔描出来，边缘带轻微不规则抖动，内部结构清晰，整体像手绘插画海报标题。', thumbnail: '8手绘字体/29轮廓手绘体.png' },
  { id: '30', style_id: 'handdrawn-2', category_id: 'handdrawn', name: '插画装饰体', prompt: '"奇妙日常"，插画装饰体，字形圆润活泼，笔画像小插画一样被画出来，局部结构带星星、圆点、叶片般的图形化变化，整体像儿童绘本封面标题。', thumbnail: '8手绘字体/30插画装饰体.png' },
  { id: '31', style_id: 'handdrawn-3', category_id: 'handdrawn', name: '粗描海报体', prompt: '"画出灵感"，草稿描线体，字形像设计草稿里的快速构思，笔画由多次重复描线组成，线条有断续和重叠感，结构自由但可读，整体像创作者画出来的标题字。', thumbnail: '8手绘字体/31粗描海报体.png' },
  { id: '32', style_id: 'handdrawn-4', category_id: 'handdrawn', name: '童趣涂鸦体', prompt: '"今天不错"，童趣涂画体，字形像用画笔认真涂画出来，笔画圆胖不完全对齐，结构大小错落，边缘带手工涂画痕迹，整体天真、轻松、有儿童画感。', thumbnail: '8手绘字体/32童趣涂鸦体.png' },
  // 涂鸦字体
  { id: '33', style_id: 'graffiti-1', category_id: 'graffiti', name: '街头涂鸦字', prompt: '"天马行空"，锋利街头喷漆体，字形大幅倾斜张扬，笔画像高速喷漆扫过墙面，粗硬笔触带尖锐切角，边缘有喷漆颗粒、飞溅和干刷断裂，四个字横向紧凑排列，整体像街头墙面上攻击性很强的喷漆涂鸦标题。', thumbnail: '9涂鸦字体/33街头涂鸦字.png' },
  { id: '34', style_id: 'graffiti-2', category_id: 'graffiti', name: '青年观点字', prompt: '"别装成熟"，手写标语涂鸦体，字形像粗马克笔在墙面上快速写下，笔画粗细不均，线条带明显手写停顿、拖拽和急停痕迹，四个字保持清晰可读，排列紧凑但不互相重叠，整体像年轻人写在街头墙上的反叛标语。', thumbnail: '9涂鸦字体/34青年观点字.png' },
  { id: '35', style_id: 'graffiti-3', category_id: 'graffiti', name: '泡泡潮流涂鸦字', prompt: '"能工智人"，泡泡潮牌涂鸦体，字形圆胖夸张，笔画厚实膨胀，外轮廓像街头 bubble graffiti 一样饱满，局部结构被拉伸和挤压，文字上下错位堆叠，整体像潮牌海报里的泡泡涂鸦标题。', thumbnail: '9涂鸦字体/35泡泡潮流涂鸦字.png' },
  { id: '36', style_id: 'graffiti-4', category_id: 'graffiti', name: '爆裂摇滚涂鸦字', prompt: '"声音失控"，爆裂摇滚涂鸦体，字形像被音浪震碎后重新拼成，笔画粗暴破碎，边缘有撕裂毛刺和碎片感，文字采用上下错位的爆炸式构图，局部笔画向外冲出，整体像地下摇滚演出海报上的失控标题。黑底白字，纯字体设计，无装饰。', thumbnail: '9涂鸦字体/36爆裂摇滚涂鸦字.png' },
  // 艺术字体
  { id: '37', style_id: 'art-1', category_id: 'art', name: '抽象艺术字', prompt: '"浑然天成"，抽象构成体，字形由几何块面和抽象线条重新组合，笔画结构打破常规但保持可读，局部笔画像图形元素一样错位拼接，整体像现代艺术海报中的构成主义标题。', thumbnail: '10艺术字体/37抽象艺术字.png' },
  { id: '38', style_id: 'art-2', category_id: 'art', name: '展览字', prompt: '"视觉实验"，展览海报体，字形克制而有设计感，笔画结构被轻微拉伸和切分，线条干净，字距舒展，整体像艺术馆、设计展或美术馆海报中的高级标题。', thumbnail: '10艺术字体/38展览字.png' },
  { id: '39', style_id: 'art-3', category_id: 'art', name: '概念实验字', prompt: '"意识流动"，概念实验体，字形结构不规则，笔画像被拆解后重新排列，局部线条断开、漂移和错层，整体保持可读但充满先锋实验感，像概念艺术展的标题字。', thumbnail: '10艺术字体/39概念实验字.png' },
  { id: '40', style_id: 'art-4', category_id: 'art', name: '创作者标题字', prompt: '"灵感爆炸"，创作者爆发体，字形夸张有张力，笔画向外扩张，局部结构放大、扭转和冲出边界，整体像创作者灵感喷发时形成的强视觉标题。', thumbnail: '10艺术字体/40创作者标题字.png' },
  // 夸张体
  { id: '41', style_id: 'exaggerated-1', category_id: 'exaggerated', name: '强冲击标题字', prompt: '"巨大反差"，强冲击夸张体，字形极度放大，笔画粗壮厚重，结构被压缩得紧密有力量，局部笔画夸张加宽，整体像强冲击海报中的重磅标题。', thumbnail: '11夸张体/41强冲击标题字.png' },
  { id: '42', style_id: 'exaggerated-2', category_id: 'exaggerated', name: '爆款封面字', prompt: '"一眼看懂"，爆款封面体，字形粗黑醒目，笔画饱满直接，结构清晰紧凑，字与字之间排列有强烈标题节奏，整体像短视频封面或爆款文章封面上的大标题。', thumbnail: '11夸张体/42爆款封面字.png' },
  { id: '43', style_id: 'exaggerated-3', category_id: 'exaggerated', name: '表情包标题字', prompt: '"离谱现场"，表情包夸张体，字形故意变形放大，笔画圆胖又不规则，结构带夸张扭动和表情感，字与字大小错落，整体像搞笑表情包里的情绪标题。', thumbnail: '11夸张体/43表情包标题字.png' },
  { id: '44', style_id: 'exaggerated-4', category_id: 'exaggerated', name: '强观点夸张字', prompt: '"别再内耗"，强观点夸张体，字形锋利紧绷，笔画粗硬有力量，结构向前倾斜，横竖转折带明显冲撞感，整体像观点海报中一句掷地有声的强表达标题。', thumbnail: '11夸张体/44强观点夸张字.png' },
  // 未来感字体
  { id: '45', style_id: 'futuristic-1', category_id: 'futuristic', name: '科技标题字', prompt: '"未来入口"，科技标题体，字形硬朗几何，笔画平直有力，横竖转折接近直角，局部结构带轻微切角，字距克制，整体像未来科技产品发布会的大标题。', thumbnail: '12未来感字体/45科技标题字.png' },
  { id: '46', style_id: 'futuristic-2', category_id: 'futuristic', name: '液态未来字', prompt: '"流动智能"，液态未来体，字形像被柔性材料生成，笔画有流体般的弯折和拉伸，边缘顺滑，结构在稳定和变形之间保持平衡，整体像未来材料、AI 生命体或新科技品牌标题。', thumbnail: '12未来感字体/46液态未来字.png' },
  { id: '47', style_id: 'futuristic-3', category_id: 'futuristic', name: '虚拟空间字', prompt: '"虚拟边界"，虚拟空间体，字形带空间透视和折叠感，笔画像立体平面被切开后重新组合，结构有前后层次和空间错位，整体像虚拟现实、元宇宙或空间计算系统标题。', thumbnail: '12未来感字体/47虚拟空间字.png' },
  { id: '48', style_id: 'futuristic-4', category_id: 'futuristic', name: '赛博断裂字', prompt: '"量化信号"，赛博断裂体，字形冷峻锋利，笔画被数字故障切成错位片段，局部结构有横向漂移、断裂和重组感，整体像高强度赛博世界、未来交易系统或数字战场标题。', thumbnail: '12未来感字体/48赛博断裂字.png' },
  // 趣味变形体
  { id: '49', style_id: 'funny-1', category_id: 'funny', name: '趣味标题字', prompt: '"脑洞打开"，趣味标题体，字形轻微变形，笔画圆润有弹性，结构大小略有错落，局部笔画像被轻轻拉伸，整体轻松、有趣、像创意内容栏目的标题字。', thumbnail: '13趣味变形体/49趣味标题字.png' },
  { id: '50', style_id: 'funny-2', category_id: 'funny', name: '搞笑封面字', prompt: '"笑到离谱"，搞笑封面体，字形夸张扭动，笔画圆胖不规则，结构像被笑声挤压变形，字与字大小错落，整体像搞笑视频封面或热梗表情标题。', thumbnail: '13趣味变形体/50搞笑封面字.png' },
  { id: '51', style_id: 'funny-3', category_id: 'funny', name: '创意课程字', prompt: '"一学就会"，模块课程标题体，字形清晰规整，笔画饱满厚实，局部结构像卡片模块一样拼接组合，横画和竖画带轻微错位层次，转角柔和但不圆滑，整体像创意课程、知识卡片或教程封面中的现代标题字。', thumbnail: '13趣味变形体/51创意课程字.png' },
  { id: '52', style_id: 'funny-4', category_id: 'funny', name: '儿童活动字', prompt: '"快乐出发"，气球童趣体，字形圆润鼓起，笔画像充气气球一样饱满柔软，结构高低跳跃，局部笔画带轻微膨胀和收束感，整体轻快、天真、像儿童活动海报里的欢乐标题字。', thumbnail: '13趣味变形体/52儿童活动字.png' },
  // 像素风格体
  { id: '53', style_id: 'pixel-1', category_id: 'pixel', name: '复古游戏字', prompt: '"像素人生"，复古像素体，字形由清晰的小方块像素拼成，横竖结构规整，边缘呈阶梯状锯齿感，整体像 8bit 复古游戏里的标题字。', thumbnail: '14像素风格体/53复古游戏字.png' },
  { id: '54', style_id: 'pixel-2', category_id: 'pixel', name: '街机游戏字', prompt: '"开局暴击"，街机游戏体，字形厚重紧凑，笔画由大块像素组成，结构方正有力量，边缘带明显像素台阶，整体像街机游戏或游戏封面里的高能标题字。', thumbnail: '14像素风格体/54街机游戏字.png' },
  { id: '55', style_id: 'pixel-3', category_id: 'pixel', name: '像素故障字', prompt: '"信号丢失"，像素故障体，字形由方块像素组成，局部笔画出现横向错位、缺块和断裂，结构保持可读但带明显数字故障感，整体像复古屏幕出现干扰时的标题字。', thumbnail: '14像素风格体/55像素字.png' },
  { id: '56', style_id: 'pixel-4', category_id: 'pixel', name: '方块模块字', prompt: '"模块世界"，方块模块体，字形由规整方形模块拼接而成，笔画方正厚实，结构像网格系统中搭建出来的文字，整体清晰、秩序、像像素化系统标题。', thumbnail: '14像素风格体/56方块模块字.png' },
  // 复古字体
  { id: '57', style_id: 'vintage-1', category_id: 'vintage', name: '老电影字', prompt: '"旧梦重温"，老电影字幕体，字形端正克制，笔画粗细适中，结构清晰稳定，边缘带轻微旧胶片字幕的印刷颗粒感，整体像上世纪电影片头或老字幕里的怀旧标题字。', thumbnail: '15复古字体/57老电影字.png' },
  { id: '58', style_id: 'vintage-2', category_id: 'vintage', name: '霓虹旧街字', prompt: '"霓虹旧街"，港式旧招牌体，字形厚重醒目，结构紧凑饱满，笔画带老式商号招牌的方正骨架和手工刻字感，转折处略带复古圆角，整体像八九十年代港式老街店招、旧茶餐厅或传统商铺牌匾标题。', thumbnail: '15复古字体/58霓虹旧街.png' },
  { id: '59', style_id: 'vintage-3', category_id: 'vintage', name: '复古广告字', prompt: '"省钱才是硬道理"，复古字体，笔画粗壮，字形带老式招牌感，整体怀旧、接地气。', thumbnail: '15复古字体/59复古广告字.png' },
  { id: '60', style_id: 'vintage-4', category_id: 'vintage', name: '复古故事字', prompt: '"纸上年华"，怀旧出版体，字形端庄清晰，笔画带传统印刷标题字的稳重感，结构舒展有书卷气，横竖比例均衡，整体像旧杂志、老书封面或怀旧刊物中的标题字。', thumbnail: '15复古字体/60复古故事字.png' },
  // 哥特风格字体
  { id: '61', style_id: 'gothic-1', category_id: 'gothic', name: '暗黑标题字', prompt: '"哈利波特"，哥特风格字体，线条尖锐细长，笔画粗细对比鲜明，整体神秘、冷峻。', thumbnail: '16哥特风格字体/61暗黑标题字.png' },
  { id: '62', style_id: 'gothic-2', category_id: 'gothic', name: '中世纪字', prompt: '"魔兽世界"，哥特风格字体，笔画尖锐，字形像铁刺延展，结构复杂但清晰，整体奇幻、危险。', thumbnail: '16哥特风格字体/62中世纪字.png' },
  { id: '63', style_id: 'gothic-3', category_id: 'gothic', name: '黑金属尖刺字', prompt: '"深渊回声"，黑金属尖刺体，字形极度尖锐，笔画向上下延伸成刺状结构，转折处带锋利裂口，整体紧密、凌厉、攻击性强，像黑金属乐队 Logo 或暗黑演出海报标题。', thumbnail: '16哥特风格字体/63黑金属尖刺字.png' },
  { id: '64', style_id: 'gothic-4', category_id: 'gothic', name: '华丽哥特饰字', prompt: '"秘银王冠"，华丽哥特装饰体，字形高挑纤长，笔画带尖细起收笔和优雅弯折，局部结构有克制的哥特花体装饰感，整体神秘、精致、像暗黑宫廷或哥特珠宝品牌标题。', thumbnail: '16哥特风格字体/64华丽哥特饰字.png' },
  // 毛笔字
  { id: '65', style_id: 'brush-1', category_id: 'brush', name: '报头题字体', prompt: '"人民日报"，报头题字毛笔体，字形庄重开阔，笔画厚实有墨色重量，带传统毛笔题词的顿挫和筋骨，横画沉稳，竖画有力，结构端正大气。根据书法气质自动采用更适合的传统字形或繁体写法，但保持文字含义准确可读。整体像中文主流报纸报头、时代刊物封面或重要题词中的权威标题字。', thumbnail: '17毛笔字/65报头提题体.png' },
  { id: '66', style_id: 'brush-2', category_id: 'brush', name: '狂草书法体', prompt: '"山海之间"，高级狂草毛笔字 Logo，黑色纯背景，白色水墨书法，纯字体设计。要求字体极具狂草气势，笔画连绵飞动，粗细强烈对比，起笔有顿挫，行笔迅疾，收笔带锋。整体像书法大师一气呵成，带有山势起伏、海浪流动的抽象节奏。保留可读性，但结构不必工整，允许适度变形、连笔、飞白、断墨、墨迹晕染。', thumbnail: '17毛笔字/66狂草书法体.png' },
  { id: '67', style_id: 'brush-3', category_id: 'brush', name: '行书体', prompt: '"行云流水"，潇洒行书练笔体，字形飘逸流动，笔画带真实行书练笔的提按、转腕、连带和细微牵丝，线条粗细灵活变化，部分笔画轻盈游走，部分笔画沉稳压住，字与字之间气脉连续但保持清晰可读。整体随性、有功力，像书法家在宣纸上一气呵成写下的文化品牌题字。根据书法气质自动采用更适合的传统字形或繁体写法，但保持文字含义准确可读。', thumbnail: '17毛笔字/67行书体.png' },
  { id: '68', style_id: 'brush-4', category_id: 'brush', name: '禅意体', prompt: '"难得糊涂"，老先生禅意题字体，字形松弛随性，笔画像毛笔蘸墨后慢慢写下，起笔有停顿，行笔有自然抖动和提按变化，收笔不刻意修饰，线条有粗有细、有圆有扁，结构不完全对齐，字与字之间有手写呼吸感。整体随意中带功力，温和中有识别度，像民宿招牌、茶室题字、山居民宿 Logo、东方生活方式品牌题字。根据书法气质自动采用更适合的传统字形或繁体写法，但保持文字含义准确可读。', thumbnail: '17毛笔字/68禅意体.png' },
  // 西部手写字体
  { id: '69', style_id: 'western-1', category_id: 'western', name: '西部牛仔标题体', prompt: '"荒野来信"，西部牛仔标题体，字形粗犷硬朗，笔画厚重有力量，结构带美式西部木牌招牌的方正感，转角略带粗糙切削痕迹，边缘有轻微旧印刷磨损，整体像牛仔酒馆、荒野小镇或西部电影海报中的中文标题字。黑底白字，纯字体设计，无装饰。', thumbnail: '18西部手写字体/69西部牛仔标题体.png' },
  { id: '70', style_id: 'western-2', category_id: 'western', name: '通缉令字体', prompt: '"落日公路"，美式公路字体，字形横向舒展，笔画干净有速度感，结构像复古公路路牌和汽车旅馆招牌的中文标题，线条稳重但不笨重，边缘带轻微旧漆脱落和风吹日晒的磨损感，整体像 66 号公路、落日旅行或复古公路海报标题。', thumbnail: '18西部手写字体/70通缉令字体.png' },
  { id: '71', style_id: 'western-3', category_id: 'western', name: '赏金字', prompt: '"赏金猎人"，荒野通缉令标题体，字形粗犷压缩，笔画像西部 WANTED 海报中的木刻粗衬线字体，横竖厚重，转角带刀削感和木牌刻痕，结构紧凑有压迫感，整体像牛仔小镇、赏金通缉令，酒馆公告或荒漠故事封面标题。边缘有沙尘颗粒、纸张破旧和印刷缺墨，但避免中国复古海报、旧报刊、老广告标题感。', thumbnail: '18西部手写字体/71赏金字.png' },
  { id: '72', style_id: 'western-4', category_id: 'western', name: '机车西部字', prompt: '"自由骑士"，机车西部体，字形锋利硬派，笔画粗壮有冲击力，结构带复古机车俱乐部、皮革徽章和西部酒馆招牌的混合气质，转折处有尖角、金属刻印感和粗犷切削边缘，边缘带轻微磨损。整体像机车文化、荒野骑行、牛仔公路或硬派复古品牌标题。', thumbnail: '18西部手写字体/72机车西部字.png' },
  // 国潮体
  { id: '73', style_id: 'chinese-1', category_id: 'chinese', name: '东方瘦金体', prompt: '"东方醒来"，东方瘦金标题体，字形高挑清峻，笔画细而有锋芒，横画舒展如弦，竖画挺拔如骨，转折处带瘦金体的尖锐顿挫和书法筋骨，结构疏朗有贵气，整体像高级国风海报、新中式品牌或东方美学展览标题。', thumbnail: '19国潮体/73东方瘦金体体.png' },
  { id: '74', style_id: 'chinese-2', category_id: 'chinese', name: '国风牌匾体', prompt: '"山河入梦"，国风牌匾体，字形厚重饱满，笔画带传统牌匾字的稳重骨架，横画宽阔沉着，竖画有力，起收笔带手工刻字般的方圆顿挫，结构紧凑端庄，整体像老字号牌匾、国风店招或传统文化品牌标题。', thumbnail: '19国潮体/74国风牌匾体.png' },
  { id: '75', style_id: 'chinese-3', category_id: 'chinese', name: '潮流篆意体', prompt: '"万象更新"，潮流篆意体，字形吸收篆书的圆转结构和对称秩序，笔画被现代化简化重组，线条厚实流畅，结构带图腾感和潮流视觉张力，整体像国潮品牌或东方潮流海报标题。', thumbnail: '19国潮体/75潮流篆意体.png' },
  { id: '76', style_id: 'chinese-4', category_id: 'chinese', name: '东方海报体', prompt: '"伯牙绝弦"，东方海报体，字形大气张扬，笔画带书法飞白和现代海报的块面冲击，结构舒展有势，横竖转折富有力量，整体像国风电影、东方美学展览或新国潮海报中的主标题。', thumbnail: '19国潮体/76东方海报.png' },
  // 童趣商业字体
  { id: '77', style_id: 'kids-1', category_id: 'kids', name: '儿童绘本体', prompt: '"云朵小孩"，儿童绘本蜡笔手绘体，字形圆润自然，笔画像儿童绘本封面里的蜡笔或彩铅手绘标题，线条柔和但不膨胀，边缘有轻微手绘颗粒和不均匀感，结构高低错落但清楚可读，整体温暖、天真、有故事感，像儿童绘本封面、亲子阅读栏目或儿童故事标题。', thumbnail: '20童趣商业字体/77儿童绘本体.png' },
  { id: '78', style_id: 'kids-2', category_id: 'kids', name: '乐高玩具体', prompt: '"快乐开箱"，积木拼装标题体，字形由大块圆角积木模块组合而成，笔画像玩具积木一样厚实，平整、有卡扣感，结构轻微错位堆叠，字与字之间有拼装玩具的节奏感，但保持每个汉字清楚可读。整体像积木玩具盒、儿童益智产品包装或拼装游戏 Logo。', thumbnail: '20童趣商业字体/78乐高玩具体.png' },
  { id: '79', style_id: 'kids-3', category_id: 'kids', name: '零食包装字', prompt: '"糖果派对"，零食包装跳跳体，字形活泼醒目，笔画厚实但不圆胖膨胀，结构像儿童零食袋上的中文大标题，字与字之间有轻微弹跳和错位节奏，局部笔画带手绘包装字的俏皮切角和轻快弧度。不要爱心、星星、表情、糖果图案或任何额外装饰。', thumbnail: '20童趣商业字体/79零食包装字.png' },
  { id: '80', style_id: 'kids-4', category_id: 'kids', name: '剪纸拼贴字', prompt: '"手工时间"，手剪纸片拼贴字体，字形由白色剪纸碎片拼接成中文标题，每个笔画都像独立纸片贴上去，纸片之间保留细小黑色缝隙，局部有重叠压住的层次、轻微翘边和错位。边缘有手剪毛边、纸纤维粗糙感和不均匀切口，整体童真、手作、像儿童手工课剪贴出来的标题字。保持文字清楚可读。', thumbnail: '20童趣商业字体/80剪纸拼贴字.png' },
  // 城市商业招牌体
  { id: '81', style_id: 'signboard-1', category_id: 'signboard', name: '灯管字', prompt: '"夜里开门"，城市霓虹门店字，字形像现代街区小店的发光招牌标题，笔画简洁醒目，结构规整但带轻微霓虹灯管的圆角转折感，线条像灯管弯折组成，但保持纯白字体效果。整体像夜晚便利店、酒吧、小餐馆或城市街角门店招牌。不要国风牌匾、不要老报刊、不要复古海报、不要普通粗黑字。', thumbnail: '21城市商业招牌体/81灯管字.png' },
  { id: '82', style_id: 'signboard-2', category_id: 'signboard', name: '夜市菜单字', prompt: '"夜宵上桌"，夜市菜单牌字体，字形像街边烧烤摊、砂锅店、深夜食堂菜单牌上的中文标题字，笔画厚实直接，结构紧凑醒目，转角带手写招牌的圆钝变化，字面有热闹市井感和夜宵烟火气，整体像夜市价目牌、快餐菜单大字或深夜餐饮海报标题。', thumbnail: '21城市商业招牌体/82夜市菜单字.png' },
  { id: '83', style_id: 'signboard-3', category_id: 'signboard', name: '便利贴字', prompt: '"随手买点"，便利店宽头马克笔标签体，字形像便利店货架价签和促销贴纸上用宽头油性马克笔手写出来的中文标题，笔画直接有力，线条粗实平涂，起收笔带宽头马克笔的钝角切面，边缘有轻微墨水渗透和纸面洇开感。部首交界处、笔画重叠处和转折处有明显叠墨变深效果，结构清楚但不完全工整，整体明快、真实，像社区便利店、零食货架或临时促销牌上的手写标签字。', thumbnail: '21城市商业招牌体/83便利贴字.png' },
  { id: '84', style_id: 'signboard-4', category_id: 'signboard', name: '电商促销字', prompt: '"劲爆特价"，暴走漫画促销体，字形极度夸张，笔画巨大厚实，结构被挤压、拉扯和爆裂变形，字与字之间紧密堆叠，像促销海报上冲出来的叫卖大字。整体有暴走漫画式怒吼感、超市清仓感和限时特价冲击力，视觉直接、粗暴、夸张、让人一眼停住。', thumbnail: '21城市商业招牌体/84电商促销字.png' },
];

// 获取所有分类
export function getFontCategories(): FontStyleCategory[] {
  return FONT_CATEGORIES;
}

// 按分类获取字体样式
export function getFontStyles(categoryId?: string): FontStyle[] {
  if (!categoryId) {
    return FONT_STYLES;
  }
  return FONT_STYLES.filter(style => style.category_id === categoryId);
}

// 根据ID获取字体样式
export function getFontStyleById(styleId: string): FontStyle | undefined {
  return FONT_STYLES.find(style => style.style_id === styleId);
}
