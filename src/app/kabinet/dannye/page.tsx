import { DataActions } from "../Forms";

export default function Page() {
  return (
    <>
      <h1 style={{ fontSize: "var(--fs-xl)" }}>Мои данные</h1>
      <p className="muted">По закону о персональных данных (152-ФЗ) вы можете в любой момент выгрузить свои данные, отозвать согласия и удалить аккаунт.</p>
      <DataActions />
    </>
  );
}
