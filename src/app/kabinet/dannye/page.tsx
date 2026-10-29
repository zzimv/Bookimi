import { DataActions, NameForm } from "../Forms";
import { AddressBook } from "./AddressBook";
import { currentUser } from "@/lib/auth";
import { parseAddressBook } from "@/lib/delivery";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await currentUser();
  const addresses = parseAddressBook(user?.savedAddresses) ?? [];
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Мои данные</h1>
      <p className="muted">По закону о персональных данных (152-ФЗ) вы можете в любой момент выгрузить свои данные, отозвать согласия и удалить аккаунт.</p>
      {user && <NameForm initial={user.firstName ?? ""} />}
      {user && <AddressBook addresses={addresses} />}
      <DataActions />
    </>
  );
}
