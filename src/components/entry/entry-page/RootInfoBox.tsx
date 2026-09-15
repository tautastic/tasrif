import Link from "next/link";
import { formatRoot } from "~/lib/formatting";
import type { EntryRootInfo } from "~/server/db/repository/lexical-entry";

interface RootInfoBoxProps {
  rootInfo: EntryRootInfo;
}

const RootInfoBox = ({ rootInfo }: RootInfoBoxProps) => {
  if (!rootInfo.arabic || !rootInfo.latin) {
    return null;
  }

  return (
    <div className="block sm:float-right w-full sm:w-auto mb-4 sm:mb-0 mx-auto sm:mx-0 text-center sm:text-right sm:ml-4">
      <table className="w-full max-w-80 border-collapse border border-[#b4b4b4] inline-table text-base">
        <tbody>
          <tr>
            <th className="border border-[#b4b4b4] px-3 py-1 font-medium bg-[#ddefd3] text-center">
              <a
                className="text-blue-600 hover:underline"
                href="https://en.wikipedia.org/wiki/Semitic_root"
                title="w:Semitic root"
              >
                Root
              </a>
            </th>
          </tr>
          <tr>
            <td className="border border-[#b4b4b4] px-3 py-1 text-center bg-[#f8fbf5]">
              <span className="mr-1" lang="ar">
                <Link href={`/root/${rootInfo.arabic}`} className="text-blue-700 hover:underline">
                  {formatRoot(rootInfo.arabic)}
                </Link>
              </span>
              <span lang="ar-Latn">({formatRoot(rootInfo.latin)})</span>
            </td>
          </tr>
          <tr>
            <td className="border border-[#b4b4b4] px-3 py-1 text-center bg-[#f8fbf5]">
              <Link href={`/root/${rootInfo.arabic}`} className="text-blue-600 hover:underline">
                {rootInfo.count} terms
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default RootInfoBox;
