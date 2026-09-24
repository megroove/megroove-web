import { useId } from 'react'

// 盤の光沢。**盤と一緒に回さない**（回すと安っぽく見えるし、実物の照り返しも動かない）ため、
// 回転する要素の外側に重ねて使う。装飾なので操作は一切受けない。
export default function VinylGloss({ size }: { size: number }) {
  // 同じ画面に複数の盤が出ても衝突しないよう、clipPath の id は一意にする
  const clipId = useId()

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    >
      {/* 左上から右下へ抜ける細い照り返し。盤の円でクリップする */}
      <defs>
        <clipPath id={clipId}>
          <circle cx="60" cy="60" r="57" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <ellipse
          cx="42" cy="38" rx="46" ry="16"
          fill="#FFFFFF" opacity="0.12"
          transform="rotate(-38 42 38)"
        />
        <ellipse
          cx="78" cy="86" rx="30" ry="9"
          fill="#FFFFFF" opacity="0.06"
          transform="rotate(-38 78 86)"
        />
      </g>
    </svg>
  )
}
