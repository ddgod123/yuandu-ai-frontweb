import Link from "next/link";
import { getLegalContactInfo, LEGAL_META } from "@/lib/legal";

export default async function TermsPage() {
  const { siteName, contactEmail, complaintEmail } = await getLegalContactInfo();

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">用户协议</h1>
            <p className="mt-2 text-sm text-slate-500">
              版本 {LEGAL_META.version} · 生效日期：{LEGAL_META.effectiveDate} · 更新日期：{LEGAL_META.updatedDate}
            </p>
          </div>

          <article className="prose prose-slate max-w-none text-sm leading-7">
            <p>
              本协议由【{LEGAL_META.operatorName}】（以下简称“我们”）与使用“{siteName}”网站、
              App、小程序及相关服务的用户（以下简称“你”）共同缔结。
            </p>
            <p>当你完成注册、登录或继续使用本服务，即视为你已阅读、理解并同意本协议及相关规则。</p>

            <h2>1. 协议主体与适用范围</h2>
            <ol>
              <li>本协议适用于你对以下服务的访问与使用：表情包浏览、检索、收藏、点赞、下载、投稿申请、活动参与及后续新增服务。</li>
              <li>你需具备完全民事行为能力；如你未满 18 周岁，应在监护人同意与指导下使用。</li>
              <li>你应当使用真实、合法、有效的手机号完成注册/登录，不得冒用他人身份。</li>
            </ol>

            <h2>2. 服务内容与使用前提</h2>
            <ol>
              <li>我们提供的表情包资源以互联网公开信息整理、合作授权及平台运营内容为基础。</li>
              <li>平台可能基于业务发展持续扩展服务场景与能力。</li>
            </ol>

            <h2>3. 账号规则</h2>
            <ol>
              <li>当前平台采用手机号验证码登录机制，手机号是账号识别依据之一。</li>
              <li>你应妥善保管登录状态、设备及验证码，不得出租、出借、转让账号。</li>
              <li>因你保管不善导致的风险（如账号被盗用、验证码泄露），由你自行承担相应责任。</li>
              <li>你可按平台流程申请注销账号；注销后，法律法规要求保留的信息除外。</li>
            </ol>

            <h2>4. 用户行为规范</h2>
            <p>你在使用本服务时，不得实施以下行为：</p>
            <ol>
              <li>违反法律法规、公序良俗或侵害他人合法权益。</li>
              <li>上传、发布、传播违法有害信息，或侮辱、诽谤、骚扰他人。</li>
              <li>侵犯他人知识产权、肖像权、名誉权、隐私权；</li>
              <li>以爬虫、外挂、脚本等方式干扰平台正常运行。</li>
              <li>规避风控、恶意刷量或批量盗链下载。</li>
              <li>其他经合理判断属于不当使用平台服务的行为。</li>
            </ol>
            <p>我们有权视情节采取限制功能、下架内容、封禁账号、保留证据并向监管机关报告等措施。</p>

            <h2>5. 知识产权与资源使用规则</h2>
            <ol>
              <li>平台页面设计、代码、数据库结构、运营内容等知识产权归我们或权利人所有。</li>
              <li>除非另有明确授权，平台下载资源仅限个人学习、交流、非商业场景使用。</li>
              <li>未经授权，你不得对平台资源进行商业性复制、再分发、售卖、二次授权、训练模型或其他超范围使用。</li>
              <li>你上传/提交内容时，应保证你拥有合法权利或已获充分授权。</li>
            </ol>

            <h2>6. 侵权投诉与处理</h2>
            <ol>
              <li>若你认为平台内容侵犯你的合法权益，可提交权属证明、身份证明、侵权链接及说明材料至投诉邮箱 {complaintEmail}。</li>
              <li>我们将在收到合格材料后进行审查，并视情况采取删除、屏蔽、断链、限制传播等措施。</li>
              <li>你应对投诉材料真实性、合法性负责；恶意投诉造成损失的，应承担相应责任。</li>
            </ol>

            <h2>7. 隐私与数据保护</h2>
            <p>我们将按照《隐私政策》处理你的个人信息。</p>
            <p>《隐私政策》是本协议的重要组成部分，与本协议具有同等法律效力。</p>

            <h2>8. 服务中断、变更与终止</h2>
            <ol>
              <li>我们可能因系统维护、升级、故障、监管要求等原因暂停或调整部分服务。</li>
              <li>我们有权基于业务发展对服务功能、页面、规则进行变更，并通过站内公告等方式通知。</li>
              <li>你严重违反本协议时，我们有权中止或终止提供服务。</li>
            </ol>

            <h2>9. 责任限制</h2>
            <ol>
              <li>在法律允许范围内，我们对因不可抗力、网络故障、第三方服务异常等导致的服务中断不承担违约责任，但会尽合理努力恢复。</li>
              <li>平台资源可能存在时效性、主观性或来源差异，我们不对其绝对完整性、准确性、适配性作保证。</li>
              <li>因你违反本协议或法律法规造成第三方损失的，你应自行承担责任；若因此给我们造成损失，你应予赔偿。</li>
            </ol>

            <h2>10. 通知与送达</h2>
            <ol>
              <li>平台可通过公告、站内信、短信、邮件等方式向你发送通知。</li>
              <li>通知一经发出即视为送达（法律另有规定除外）。</li>
            </ol>

            <h2>11. 协议修改</h2>
            <ol>
              <li>我们有权根据法律法规及业务调整更新本协议。</li>
              <li>更新后的协议将公布于平台并注明生效日期。</li>
              <li>协议更新后你继续使用服务，视为你接受更新内容。</li>
            </ol>

            <h2>12. 适用法律与争议解决</h2>
            <ol>
              <li>本协议适用中华人民共和国大陆地区法律。</li>
              <li>因本协议产生的争议，双方应先友好协商；协商不成的，提交运营主体住所地有管辖权的人民法院诉讼解决。</li>
            </ol>

            <h2>13. 联系方式</h2>
            <p>运营主体： 【{LEGAL_META.operatorName}】</p>
            <p>联系邮箱： 【{contactEmail}】</p>
            <p>版权投诉邮箱： 【{complaintEmail}】</p>
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
