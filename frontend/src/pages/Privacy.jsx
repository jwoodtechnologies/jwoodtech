import { useEffect } from "react";
import { LegalPage, Section } from "./LegalPage";

const Privacy = () => {
  useEffect(() => {
    document.title = "Privacy · Jwood Technologies";
    return () => {
      document.title = "Jwood Technologies";
    };
  }, []);

  return (
    <LegalPage title="Privacy Policy" effective="February 2026">
      <Section title="Overview">
        <p>
          Jwood Technologies ("we", "our", "us") builds AI-native software,
          apps and websites, including WoodX — a privacy-focused messaging
          product. This policy explains what information we collect when you
          use our websites and products, how we use it, and the controls you
          have over it.
        </p>
      </Section>

      <Section title="Information we collect">
        <p>
          <strong className="text-white">Account information.</strong> When
          you create a WoodX account we store your first and last name,
          email address, and a one-way bcrypt hash of your password. We do
          not store your plain-text password.
        </p>
        <p>
          <strong className="text-white">Content you send.</strong> Messages,
          group and room details, uploaded profile photos, tags, and chat
          preferences (pin, mute, disappearing timer) are stored so we can
          deliver the service. Disappearing messages are removed on the
          server automatically when the timer expires.
        </p>
        <p>
          <strong className="text-white">Contact submissions.</strong> When
          you use a form on our website (contact, chatbot) we keep the
          information you provide so we can respond.
        </p>
        <p>
          <strong className="text-white">Technical data.</strong> We receive
          standard technical signals from your browser (IP address, user
          agent, request timestamps) to operate the service, prevent abuse,
          and troubleshoot.
        </p>
      </Section>

      <Section title="How we use information">
        <p>We use the information above to:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>deliver, maintain and improve our products;</li>
          <li>route messages between accounts you choose to communicate with;</li>
          <li>respond to contact and support requests;</li>
          <li>
            keep the service secure and investigate abuse or violations of our
            Terms of Service.
          </li>
        </ul>
      </Section>

      <Section title="Sharing">
        <p>
          We do not sell personal information. We share information only with
          service providers that help us run the product (for example, email
          delivery, hosting, AI providers that process messages you send to
          EON, our Wood AI assistant). Those providers are bound by contract
          to protect your information.
        </p>
      </Section>

      <Section title="Retention and deletion">
        <p>
          You can delete individual messages, entire chats, and your account
          from WoodX Settings. When you delete your account we remove your
          profile and personal data from our active systems; copies may remain
          in routine backups for a short period before being overwritten.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We use industry-standard safeguards including TLS in transit,
          bcrypt-hashed passwords and scoped JWT sessions. WoodX in its
          current beta provides privacy-focused messaging tools — we do not
          currently offer full end-to-end encryption, and we will update this
          page if that changes.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Jwood Technologies products are not directed to children under 13,
          and we do not knowingly collect information from children.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can access and update your profile in WoodX Settings, change
          your password, or delete your account at any time. To make a data
          request, email{" "}
          <a
            href="mailto:info@jwoodtechnologies.com"
            className="text-white underline underline-offset-2"
          >
            info@jwoodtechnologies.com
          </a>
          .
        </p>
      </Section>

      <Section title="Updates">
        <p>
          We may update this policy as our products evolve. When we make
          material changes we will update the effective date at the top of
          this page and, where appropriate, notify you in-product.
        </p>
      </Section>
    </LegalPage>
  );
};

export default Privacy;
