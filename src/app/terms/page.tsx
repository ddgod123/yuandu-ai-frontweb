import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">用户协议</h1>
            <p className="mt-2 text-sm text-slate-500">版本 v1.0 · 生效日期：2026-03-05</p>
          </div>

          <article className="prose prose-slate max-w-none text-sm leading-7">
            <p>
              本协议由【运营主体全称】（以下简称“我们”）与使用“表情包档案馆”服务的用户（以下简称“你”）共同缔结。你注册、登录或继续使用本服务，即视为已阅读并同意本协议及相关规则。
            </p>

            <h2>1. 协议主体与适用范围</h2>
            <ol>
              <li>本协议适用于你对网站、App、小程序及后续新增服务的访问与使用。</li>
              <li>服务包括表情包浏览、检索、收藏、点赞、下载、投稿申请、活动参与等。</li>
              <li>如你未满18周岁，应在监护人同意与指导下使用本服务。</li>
            </ol>

            <h2>2. 服务内容与使用前提</h2>
            <ol>
              <li>平台内容来源包括公开信息整理、合作授权、平台运营内容等。</li>
              <li>你应使用真实、合法、有效的手机号完成注册/登录，不得冒用他人身份。</li>
            </ol>

            <h2>3. 账号规则</h2>
            <ol>
              <li>平台采用手机号验证码登录机制，手机号是账号识别依据之一。</li>
              <li>你应妥善保管设备、验证码及登录状态，不得出租、出借、转让账号。</li>
              <li>因你保管不善导致的风险由你自行承担。</li>
              <li>你可按流程申请注销账号，法律法规要求保留的信息除外。</li>
            </ol>

            <h2>4. 用户行为规范</h2>
            <p>你不得实施以下行为：</p>
            <ol>
              <li>违反法律法规、公序良俗或侵害他人合法权益；</li>
              <li>传播违法有害信息，或侮辱、诽谤、骚扰他人；</li>
              <li>侵犯他人知识产权、肖像权、名誉权、隐私权；</li>
              <li>使用爬虫、外挂、脚本干扰平台运行；</li>
              <li>规避风控、恶意刷量或批量盗链下载。</li>
            </ol>
            <p>我们有权视情节采取限制功能、下架内容、封禁账号等措施，并保留依法追责权利。</p>

            <h2>5. 知识产权与资源使用规则</h2>
            <ol>
              <li>平台页面设计、代码、数据库结构、运营内容等知识产权归我们或权利人所有。</li>
              <li>除非另有授权，下载资源仅限个人学习、交流、非商业场景使用。</li>
              <li>未经授权，不得商业复制、再分发、售卖、二次授权或用于模型训练。</li>
              <li>你上传/提交内容时，应保证你拥有合法权利或已获充分授权。</li>
            </ol>

            <h2>6. 侵权投诉与处理</h2>
            <ol>
              <li>权利人可提交身份证明、权属证明、侵权链接及说明材料至版权投诉邮箱。</li>
              <li>我们在收到合格材料后将进行审查，并依法采取删除、屏蔽、断链等措施。</li>
              <li>恶意投诉造成损失的，投诉方应承担相应责任。</li>
            </ol>

            <h2>7. 隐私与数据保护</h2>
            <p>
              我们按照《隐私政策》处理你的个人信息。《隐私政策》是本协议的重要组成部分，与本协议具有同等法律效力。
            </p>

            <h2>8. 服务中断、变更与终止</h2>
            <ol>
              <li>我们可能因维护、升级、故障、监管要求等原因暂停或调整部分服务。</li>
              <li>我们有权基于业务发展对功能、页面和规则进行变更，并通过公告等方式通知。</li>
              <li>你严重违反本协议时，我们有权中止或终止提供服务。</li>
            </ol>

            <h2>9. 责任限制</h2>
            <ol>
              <li>在法律允许范围内，我们对不可抗力、网络故障、第三方服务异常导致的中断不承担违约责任。</li>
              <li>平台资源可能存在时效性、主观性或来源差异，不构成绝对完整或准确保证。</li>
              <li>因你违反本协议或法律法规造成损失的，你应自行承担责任并赔偿由此造成的平台损失。</li>
            </ol>

            <h2>10. 通知与送达</h2>
            <ol>
              <li>平台可通过公告、站内信、短信、邮件等方式向你发送通知。</li>
              <li>通知一经发出即视为送达（法律另有规定除外）。</li>
            </ol>

            <h2>11. 协议修改</h2>
            <ol>
              <li>我们可根据法律法规及业务调整更新本协议。</li>
              <li>更新版本将在平台公布并注明生效日期。</li>
              <li>你在更新后继续使用服务，视为接受更新内容。</li>
            </ol>

            <h2>12. 适用法律与争议解决</h2>
            <ol>
              <li>本协议适用中华人民共和国大陆地区法律。</li>
              <li>争议优先友好协商；协商不成，提交【运营主体所在地】有管辖权人民法院处理。</li>
            </ol>

            <h2>13. 联系方式</h2>
            <p>运营主体： 【请填写】</p>
            <p>联系邮箱： 【请填写】</p>
            <p>版权投诉邮箱： 【请填写】</p>
            <p>联系地址： 【请填写】</p>
          </article>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 text-xs">
            <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              返回首页
            </Link>
            <Link href="/privacy" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              查看隐私政策
            </Link>
            <Link href="/disclaimer" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              查看免责声明
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
