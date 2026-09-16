import FooterAuthLink from "~/components/layout/FooterAuthLink";

const Footer = () => (
  <footer className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
    <span>Tasrif — Arabic morphological engine</span>
    <span aria-hidden="true">·</span>
    <FooterAuthLink />
  </footer>
);

export default Footer;
