import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">隐私政策</h1>
            <p className="mt-2 text-sm text-slate-500">版本 v1.0 · 生效日期：2026-03-05</p>
          </div>

          <article className="prose prose-slate max-w-none text-sm leading-7">
            <p>
              我们遵循合法、正当、必要、诚信原则，仅为实现业务功能和保障安全处理你的个人信息。
            </p>

            <h2>1. 我们如何收集和使用个人信息</h2>
            <h3>1.1 账号与身份认证</h3>
            <ol>
              <li>手机号；</li>
              <li>短信验证码校验结果；</li>
              <li>登录时间、IP、设备标识、浏览器信息、操作日志。</li>
            </ol>

            <h3>1.2 业务功能信息</h3>
            <ol>
              <li>你对合集/单图的浏览、搜索、点赞、收藏、下载记录；</li>
              <li>你提交的资料（如加入申请中的姓名、电话、性别、年龄、邮箱、职业）；</li>
              <li>反馈意见、投诉和工单信息。</li>
            </ol>

            <h3>1.3 运营与安全保障</h3>
            <ol>
              <li>访问日志、异常日志、安全审计记录；</li>
              <li>防刷、防滥用、防攻击相关特征信息；</li>
              <li>必要统计分析信息（通常以去标识化/聚合方式使用）。</li>
            </ol>

            <h2>2. Cookie 与同类技术</h2>
            <ol>
              <li>我们使用 Cookie、LocalStorage、会话标识维持登录状态、提升体验与保障安全。</li>
              <li>你可通过浏览器设置管理 Cookie；关闭后部分功能可能受影响。</li>
            </ol>

            <h2>3. 共享、委托处理和公开披露</h2>
            <h3>3.1 共享与委托处理</h3>
            <p>在实现核心功能的必要范围内，我们可能与以下服务提供方共享最小必要信息：</p>
            <ol>
              <li>短信服务商（发送验证码）；</li>
              <li>云存储/CDN 服务商（资源分发）；</li>
              <li>基础云计算与安全服务商（稳定运行与风控）。</li>
            </ol>
            <p>我们会与相关方签署协议并要求其履行数据保护义务。</p>

            <h3>3.2 公开披露</h3>
            <p>除法律法规要求或经你单独同意外，我们不会公开披露你的个人信息。</p>

            <h2>4. 存储和保护</h2>
            <ol>
              <li>存储地点：原则上在中华人民共和国境内存储；</li>
              <li>存储期限：在实现处理目的必要的最短期限内保存；</li>
              <li>安全措施：访问控制、最小权限、传输加密、日志审计、漏洞修复、备份恢复；</li>
              <li>发生或可能发生安全事件时，我们将依法启动应急预案并通知你。</li>
            </ol>

            <h2>5. 你的权利</h2>
            <p>你有权依法进行查询、复制、更正、补充、删除、撤回同意、注销账号并要求解释处理规则。</p>
            <p>你可通过“联系我们”提交请求，我们通常会在15个工作日内处理并回复。</p>

            <h2>6. 未成年人保护</h2>
            <ol>
              <li>本服务主要面向成年人；</li>
              <li>未成年人应在监护人同意和指导下使用；</li>
              <li>若发现未经同意收集未成年人信息，我们将依法尽快删除或匿名化处理。</li>
            </ol>

            <h2>7. 第三方链接与服务</h2>
            <p>平台可能包含第三方链接或跳转。第三方服务独立运营，其处理规则不受本政策约束。</p>

            <h2>8. 政策更新</h2>
            <ol>
              <li>我们可能因法律法规或业务调整更新本政策；</li>
              <li>更新版本将在平台显著位置公布并注明生效日期；</li>
              <li>重大变更时，我们会通过合理方式再次提示你。</li>
            </ol>

            <h2>9. 联系我们</h2>
            <p>运营主体： 【请填写】</p>
            <p>联系邮箱： 【请填写】</p>
            <p>隐私专用邮箱（建议单独设置）： 【请填写】</p>
            <p>联系地址： 【请填写】</p>

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
