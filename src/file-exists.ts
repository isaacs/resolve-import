import { stat } from 'fs/promises'
export const fileExists = async (f: string | URL): Promise<boolean> =>
  stat(f).then(
    st => st.isFile(),
    () => false
  )
