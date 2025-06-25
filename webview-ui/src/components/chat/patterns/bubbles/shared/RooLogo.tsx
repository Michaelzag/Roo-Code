import React from "react"

const RooLogo: React.FC<{ className?: string }> = ({ className }) => {
	const rooLogoUri = (window as any).IMAGES_BASE_URI + "/roo-logo.svg"
	return (
		<div
			className={`h-4 w-4 ${className}`}
			style={{
				backgroundColor: "currentColor",
				WebkitMaskImage: `url('${rooLogoUri}')`,
				WebkitMaskRepeat: "no-repeat",
				WebkitMaskSize: "contain",
				maskImage: `url('${rooLogoUri}')`,
				maskRepeat: "no-repeat",
				maskSize: "contain",
			}}
		/>
	)
}

export default RooLogo
