import Link from "next/link";
import { getLegalContactInfo, LEGAL_META } from "@/lib/legal";

export default async function PrivacyPage() {
  const { contactEmail, siteName } = await getLegalContactInfo();

  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">隐私政策</h1>
            <p className="mt-2 text-sm text-slate-500">
              版本 {LEGAL_META.version} · 生效日期：{LEGAL_META.effectiveDate} · 更新日期：{LEGAL_META.updatedDate}
            </p>
          </div>

          <article className="prose prose-slate max-w-none text-sm leading-7">
            <p>
              我们遵循合法、正当、必要、诚信原则，仅为实现 {siteName} 产品功能收集必要信息。
            </p>

            <h2>1. 我们如何收集和使用个人信息</h2>
            <h3>1.1 账号与身份认证</h3>
            <p>为完成注册/登录、账号识别与安全风控，我们可能收集：</p>
            <ol>
              <li>手机号；</li>
              <li>短信验证码验证结果；</li>
              <li>登录时间、IP、设备标识、浏览器信息、操作日志。</li>
            </ol>

            <h3>1.2 业务功能信息</h3>
            <p>为提供平台功能，我们可能收集：</p>
            <ol>
              <li>你对合集/单图的浏览、搜索、点赞、收藏、下载记录；</li>
              <li>你提交的资料（如“加入申请”中填写的姓名、电话、性别、年龄、邮箱、职业）；</li>
              <li>你反馈的意见、投诉、工单信息。</li>
            </ol>

            <h3>1.3 运营与安全保障</h3>
            <p>为保障系统稳定和防范风险，我们可能处理：</p>
            <ol>
              <li>访问日志、异常日志、安全审计记录；</li>
              <li>防刷、防滥用、防攻击相关特征信息；</li>
              <li>必要统计分析信息（通常以去标识化/聚合方式使用）。</li>
            </ol>

            <h2>2. 我们如何使用 Cookie 与同类技术</h2>
            <ol>
              <li>我们使用 Cookie、LocalStorage、会话标识等技术维持登录状态、提升体验与保障安全。</li>
              <li>你可通过浏览器设置管理 Cookie；部分设置可能导致功能不可用或体验下降。</li>
            </ol>

            <h2>3. 我们如何共享、委托处理和公开披露个人信息</h2>
            <h3>3.1 共享与委托处理</h3>
            <p>在实现核心功能所必需范围内，我们可能委托或与服务提供商共享必要信息，例如：</p>
            <ol>
              <li>短信服务商（用于发送验证码）；</li>
              <li>云存储/CDN 服务商（用于资源分发）；</li>
              <li>基础云计算与安全服务商（用于稳定运行与风控）。</li>
            </ol>
            <p>我们会与相关方签署数据处理协议，并要求其采取不低于本政策的保护措施。</p>

            <h3>3.2 公开披露</h3>
            <p>除法律法规明确要求或获得你单独同意外，我们不会公开披露你的个人信息。</p>

            <h2>4. 我们如何存储和保护个人信息</h2>
            <ol>
              <li>存储地点：原则上在中华人民共和国境内存储。</li>
              <li>存储期限：在实现目的所必要最短期限内保存；法律法规另有要求的从其规定。</li>
              <li>安全措施：访问控制、最小权限、传输加密、日志审计、漏洞修复、备份恢复；</li>
              <li>一旦发生或可能发生个人信息安全事件，我们将依法启动应急预案并通知你。</li>
            </ol>

            <h2>5. 你的权利</h2>
            <p>在法律法规规定范围内，你有权：</p>
            <ol>
              <li>查询、复制你的个人信息。</li>
              <li>更正、补充不准确或不完整的信息。</li>
              <li>删除你的个人信息（在符合法定条件时）。</li>
              <li>撤回同意（不影响撤回前基于同意处理的合法性）。</li>
              <li>注销账号。</li>
              <li>要求解释个人信息处理规则。</li>
            </ol>
            <p>你可通过本政策“联系我们”方式提交请求，我们通常会在 15 个工作日内处理并回复。</p>

            <h2>6. 未成年人保护</h2>
            <ol>
              <li>我们主要面向成年人提供服务。</li>
              <li>如你是未成年人，应在监护人同意和指导下使用本服务。</li>
              <li>若我们发现未经监护人同意收集了未成年人个人信息，将依法尽快删除或匿名化处理。</li>
            </ol>

            <h2>7. 第三方链接与服务</h2>
            <p>平台可能包含第三方链接或跳转。第三方服务由其独立运营，其个人信息处理规则不受本政策约束，请你另行查阅其隐私政策。</p>

            <h2>8. 政策更新</h2>
            <ol>
              <li>我们可能因法律法规变化或业务调整更新本政策。</li>
              <li>更新后会在平台显著位置公布，并标注生效日期。</li>
              <li>重大变更时，我们会通过合理方式再次提示你。</li>
            </ol>

            <h2>9. 联系我们</h2>
            <p>运营主体： 【{LEGAL_META.operatorName}】</p>
            <p>联系邮箱： 【{contactEmail}】</p>
            <p>如你认为我们的个人信息处理行为损害了你的合法权益，你也可向有管辖权的监管部门投诉举报。</p>

            <h2>10. 适用法律</h2>
            <p>本政策适用中华人民共和国大陆地区相关法律法规。</p>
          </article>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 text-xs">
            <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              返回首页
            </Link>
            <Link href="/terms" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              查看用户协议
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
