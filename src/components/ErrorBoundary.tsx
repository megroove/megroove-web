import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

// 画面の描画中に想定外のエラーが起きても、アプリ全体が真っ白にならないための安全網。
// AppRoutes 内（pathname を key にした要素の中）に置くので、別タブに移ると自動で復帰する。
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('画面の描画でエラーが発生しました:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-[#F7EFE6] text-sm">この画面の表示中に問題が発生しました。</p>
          <p className="text-[#6b5a4a] text-xs leading-relaxed">
            下のタブで他の画面に切り替えるか、再読み込みしてください。<br />
            記録した内容は端末に保存されています。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-[#993C1D] text-[#F7EFE6] text-sm font-semibold active:opacity-80"
          >
            再読み込み
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
