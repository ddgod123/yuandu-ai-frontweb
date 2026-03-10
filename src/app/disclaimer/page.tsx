import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 md:p-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">免责声明</h1>
            <p className="mt-2 text-sm text-slate-500">
              版本 v1.0 · 生效日期：2026-03-05 · 更新日期：2026-03-05
            </p>
          </div>

          <article className="prose prose-slate max-w-none text-sm leading-7">
            <p>
              本声明是《用户协议》的组成部分，建议与《隐私政策》一并阅读；若与法律法规强制性规定冲突，以法律法规为准。
            </p>

            <h2>1. 内容来源与权利声明</h2>
            <ol>
              <li>平台部分内容来自互联网公开信息整理、用户提交、合作授权或平台原创。</li>
              <li>我们尊重并保护知识产权，权利人可通过联系邮箱提交通知，我们将依法处理。</li>
              <li>平台不因内容展示即当然获得或授予该内容的完整商业权利。</li>
            </ol>

            <h2>2. 使用风险提示</h2>
            <ol>
              <li>平台资源主要用于个人学习、交流、非商业场景。</li>
              <li>你应自行判断资源是否满足你的使用目的，并自行承担使用风险。</li>
              <li>因网络状态、设备差异、第三方服务波动导致的访问失败、下载失败、显示异常等，平台不承诺绝对无误。</li>
            </ol>

            <h2>3. 观点与时效性</h2>
            <ol>
              <li>表情包内容可能具有创作主观性、语境依赖性和时效性，不代表平台立场。</li>
              <li>对于由第三方提供或转载的内容，我们不对其绝对准确性、完整性、实时性作保证。</li>
            </ol>

            <h2>4. 第三方链接与服务</h2>
            <ol>
              <li>平台可能提供第三方链接或跳转，仅为便利用户使用。</li>
              <li>第三方网站或服务由其独立运营，平台不对其内容、隐私与安全承担责任。</li>
            </ol>

            <h2>5. 责任限制</h2>
            <p>在法律允许范围内，平台对以下情形不承担责任或仅在法定范围内承担责任：</p>
            <ol>
              <li>不可抗力（自然灾害、战争、政府行为、重大网络故障等）导致的服务中断。</li>
              <li>电信运营商、云服务、CDN、短信服务等第三方原因导致的损失；</li>
              <li>用户违反法律法规或平台规则所造成的任何后果。</li>
              <li>用户将平台内容用于商业用途或违法用途造成的争议与损失。</li>
            </ol>

            <h2>6. 侵权通知与反通知</h2>
            <ol>
              <li>权利人可提交侵权通知（身份证明、权属证明、侵权链接、具体说明）。</li>
              <li>我们在收到合格材料后，将依法采取必要措施并通知相关方。</li>
              <li>被投诉方如有异议，可依法提交反通知材料。</li>
            </ol>

            <h2>7. 条款关联</h2>
            <p>本免责声明是《用户协议》的组成部分，与《隐私政策》共同构成平台规则体系。若条款冲突，以法律法规强制性规定为准。</p>

            <h2>8. 联系方式</h2>
            <p>运营主体： 【北京元都致远科技有限公司】</p>
            <p>联系邮箱： 【3909356254@qq.com】</p>
          </article>

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6 text-xs">
            <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              返回首页
            </Link>
            <Link href="/terms" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              查看用户协议
            </Link>
            <Link href="/privacy" className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              查看隐私政策
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
