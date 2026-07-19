import type { CurrentUser } from "@/lib/auth/contracts"

interface HeaderUserIdentityProps {
  user: CurrentUser
}

export function HeaderUserIdentity({ user }: HeaderUserIdentityProps) {
  return (
    <div className="flex min-w-0 flex-col space-y-1">
      <p className="truncate text-sm leading-none font-medium" title={user.displayName}>
        {user.displayName}
      </p>
      {user.email ? (
        <p className="text-muted-foreground truncate text-xs leading-none" title={user.email}>
          {user.email}
        </p>
      ) : null}
    </div>
  )
}
