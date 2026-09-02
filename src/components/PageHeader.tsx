import { NavBar } from './NavBar'

export function PageHeader({ title }: { title: string }) {
  return <NavBar title={title} showBack />
}
