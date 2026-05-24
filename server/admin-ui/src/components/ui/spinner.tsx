import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"

function Spinner({ className, ...props }: React.SVGAttributes<SVGSVGElement>) {
  const { t } = useTranslation()
  return (
    <Loader2Icon
      role="status"
      aria-label={t("common.loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
