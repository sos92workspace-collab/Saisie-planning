import React, { useState } from 'react';

export const TermsModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-xl font-black uppercase text-slate-800">Conditions Générales d'Utilisation (CGU)</h2>
            <p className="text-sm text-slate-500 font-medium">Dernière mise à jour : 12 août 2026</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
          <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <h3 className="font-bold text-blue-900 text-base mb-2">Application « SOS 92 – Choix de Garde »</h3>
            <p className="text-blue-800">Planning de garde des médecins de SOS 92</p>
          </div>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 1 – Objet</h3>
            <p>Les présentes Conditions Générales d'Utilisation (ci-après les « CGU ») ont pour objet de définir les conditions d'accès et d'utilisation de l'application « SOS 92 – Choix de Garde » (ci-après « l'Application »), éditée par la SCM S.O.S. 92 – Garde et Urgences Médicales (ci-après « l'Éditeur »). L'Application est un outil interne destiné à l'organisation et à la gestion des plannings de garde des médecins de SOS 92.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 2 – Définitions</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>« Application »</strong> : l'outil numérique « SOS 92 – Choix de Garde » et l'ensemble de ses fonctionnalités.</li>
              <li><strong>« Éditeur »</strong> : la SCM S.O.S. 92 – Garde et Urgences Médicales, éditrice et responsable de l'Application.</li>
              <li><strong>« Utilisateur »</strong> : tout médecin ou personnel habilité de SOS 92 disposant d'un compte nominatif l'autorisant à accéder à l'Application.</li>
              <li><strong>« Compte »</strong> : l'espace personnel de l'Utilisateur, accessible au moyen d'identifiants personnels (trigramme et mot de passe).</li>
              <li><strong>« Garde / Créneau »</strong> : période de permanence des soins pouvant être choisie, échangée ou libérée via l'Application.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 3 – Acceptation des CGU</h3>
            <p>L'accès et l'utilisation de l'Application impliquent l'acceptation pleine et entière des présentes CGU. L'Utilisateur qui n'accepte pas les CGU doit renoncer à utiliser l'Application. L'Éditeur recommande que l'acceptation soit recueillie lors de la première connexion.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 4 – Accès au service et comptes utilisateurs</h3>
            <p>L'accès à l'Application est strictement réservé aux médecins et personnels habilités de SOS 92. Les comptes sont créés et administrés par les administrateurs habilités ; il n'existe pas d'inscription libre ni d'ouverture au public.</p>
            <p className="mt-2">Chaque Utilisateur se voit attribuer des identifiants personnels et confidentiels. Ces identifiants sont strictement personnels, non cessibles et ne doivent être communiqués à aucun tiers. L'Utilisateur est responsable de la préservation de la confidentialité de ses identifiants et de toute action réalisée depuis son Compte. Il s'engage à signaler sans délai à l'Éditeur toute perte, vol ou utilisation non autorisée de son Compte.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 5 – Description du service</h3>
            <p>L'Application permet notamment : la consultation des plannings de garde, la saisie et la modification des choix de créneaux, la déclaration des indisponibilités, la gestion des demandes d'échange, de reprise et d'abandon de créneaux, ainsi que la gestion des délégations de pouvoir entre praticiens.</p>
            <p className="mt-2">L'Application peut mettre à disposition des indicateurs d'aide à la répartition, dont un score de prédictibilité calculé à partir des choix des Utilisateurs. Ces indicateurs sont fournis à titre d'aide à l'organisation ; ils ne donnent pas lieu à une décision produisant des effets significatifs prise sur le seul fondement d'un traitement automatisé, une intervention humaine demeurant assurée.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 6 – Obligations de l'Utilisateur</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Utiliser l'Application dans un cadre strictement professionnel et conforme à sa destination.</li>
              <li>Saisir des informations exactes, sincères et à jour.</li>
              <li>Respecter les règles internes de SOS 92 relatives à l'organisation des gardes et à la permanence des soins.</li>
              <li>Ne pas partager ses identifiants ni permettre l'utilisation de son Compte par un tiers.</li>
              <li>Ne pas tenter d'accéder à des comptes, données ou fonctionnalités auxquels il n'est pas autorisé, ni de perturber le fonctionnement ou la sécurité de l'Application.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 7 – Disponibilité et maintenance</h3>
            <p>L'Éditeur met en œuvre des moyens raisonnables pour assurer l'accessibilité de l'Application, sans pouvoir garantir un accès continu et ininterrompu. L'accès peut être suspendu, notamment pour des opérations de maintenance, de mise à jour ou en cas de nécessité technique, y compris via un mode maintenance.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 8 – Responsabilité</h3>
            <p>L'Application est un outil d'aide à l'organisation. L'Éditeur ne saurait être tenu responsable des conséquences résultant d'erreurs ou d'omissions dans les informations saisies par les Utilisateurs, d'une indisponibilité temporaire, d'un usage non conforme, ou d'un cas de force majeure. L'organisation effective des gardes et le respect des obligations professionnelles et déontologiques relèvent de SOS 92 et de ses médecins ; l'Application ne s'y substitue pas.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 9 – Protection des données personnelles (RGPD)</h3>
            <p><strong>Responsable de traitement :</strong> SCM S.O.S. 92 – Garde et Urgences Médicales – contact : gerance@sos92.net</p>
            <p className="mt-2 font-bold">Dans le cadre de l'utilisation de l'Application, les catégories de données suivantes sont traitées :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Identité professionnelle :</strong> trigramme, nom, prénom, rôle (médecin, remplaçant, etc.).</li>
              <li><strong>Données d'organisation :</strong> choix de gardes, indisponibilités, demandes d'échange, de reprise et d'abandon, délégations de pouvoir.</li>
              <li><strong>Données de connexion et de traçabilité :</strong> horodatage des connexions et déconnexions, informations techniques relatives à l'appareil et à la résolution d'écran, journal des actions réalisées.</li>
              <li><strong>Indicateurs calculés :</strong> score de prédictibilité et données statistiques associées.</li>
              <li><strong>Données d'authentification</strong>, gérées via le prestataire technique d'authentification.</li>
            </ul>
            <p className="mt-4"><strong>Finalités :</strong> organiser et gérer les plannings de garde ; permettre les échanges et reprises de créneaux ; assurer la sécurité, la traçabilité et le bon fonctionnement de l'Application ; contribuer à une répartition équitable des gardes.</p>
            <p className="mt-2"><strong>Base légale :</strong> intérêt légitime de SOS 92 à organiser la permanence des soins et l'équité entre praticiens, et/ou exécution de la relation entre SOS 92 et ses médecins ; le cas échéant, respect d'obligations légales.</p>
            <p className="mt-2"><strong>Destinataires :</strong> les administrateurs habilités de SOS 92 et les prestataires techniques (hébergeurs) agissant en qualité de sous-traitants, dans la stricte limite des besoins liés à la fourniture du service.</p>
            <p className="mt-2"><strong>Hébergement et localisation des données :</strong> les données de l'Application (comptes, plannings, journaux) sont hébergées au sein de l'Union européenne (serveurs situés à Francfort, Allemagne, via le prestataire Supabase). Certains prestataires techniques (Google, pour l'hébergement de l'interface, les polices de caractères et la fonctionnalité d'assistance par intelligence artificielle) sont susceptibles de traiter certaines données techniques (par exemple l'adresse IP ou des métadonnées de connexion) en dehors de l'Union européenne, notamment aux États-Unis. Ces transferts sont encadrés par des garanties appropriées au sens du RGPD : l'adhésion de Google au cadre de protection des données UE–États-Unis (EU-U.S. Data Privacy Framework) et, à défaut, les clauses contractuelles types adoptées par la Commission européenne.</p>
            <p className="mt-4 font-bold">Durées de conservation :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Comptes utilisateurs :</strong> conservés pendant toute la durée de la collaboration du médecin avec SOS 92, puis supprimés ou anonymisés dans un délai maximal de 12 mois après la fin de cette collaboration.</li>
              <li><strong>Données de planning :</strong> conservées 3 ans à des fins de gestion et de preuve, puis archivées ou anonymisées.</li>
              <li><strong>Journaux de connexion et journaux techniques :</strong> conservés 12 mois, conformément aux recommandations de la CNIL.</li>
              <li><strong>Délégations de pouvoir :</strong> conservées pendant leur durée de validité, puis 3 ans.</li>
            </ul>
            <p className="mt-4"><strong>Décisions automatisées :</strong> aucune décision produisant des effets juridiques ou vous affectant de manière significative n'est prise sur le seul fondement d'un traitement automatisé ; le score de prédictibilité constitue une aide soumise à intervention humaine.</p>
            <p className="mt-2"><strong>Sécurité :</strong> l'Éditeur met en œuvre des mesures techniques et organisationnelles appropriées (authentification, contrôle et restriction des accès aux données, journalisation) afin de protéger les données contre tout accès non autorisé.</p>
            <p className="mt-2"><strong>Droits des personnes :</strong> conformément au RGPD, chaque personne concernée dispose des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de ses données. Ces droits s'exercent auprès de gerance@sos92.net. Toute personne peut également introduire une réclamation auprès de la CNIL (www.cnil.fr).</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 10 – Cookies et traceurs</h3>
            <p>L'Application utilise uniquement les traceurs strictement nécessaires à son fonctionnement, notamment au maintien de la session et de l'authentification de l'Utilisateur. Elle n'utilise pas de cookies publicitaires ni d'outil de mesure d'audience tierce, et ne requiert donc pas de recueil de consentement à ce titre.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 11 – Propriété intellectuelle</h3>
            <p>L'Application et l'ensemble de ses composants sont protégés par le droit de la propriété intellectuelle et demeurent la propriété exclusive de la SCM S.O.S. 92 – Garde et Urgences Médicales ou de ses partenaires. L'Utilisateur bénéficie d'un droit d'usage personnel, non exclusif et non transférable, limité à la durée et aux finalités de son habilitation. Toute autre exploitation est interdite sans autorisation écrite préalable.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 12 – Modification des CGU</h3>
            <p>L'Éditeur se réserve le droit de modifier à tout moment les présentes CGU afin de les adapter aux évolutions de l'Application ou de la réglementation. Les Utilisateurs sont informés des modifications ; la poursuite de l'utilisation de l'Application après leur entrée en vigueur vaut acceptation.</p>
          </section>

          <section>
            <h3 className="text-base font-black uppercase text-slate-900 mb-2">Article 13 – Droit applicable et juridiction compétente</h3>
            <p>Les présentes CGU sont régies par le droit français. En cas de différend relatif à leur interprétation ou à leur exécution, les parties s'efforceront de rechercher une solution amiable. À défaut, compétence est attribuée aux tribunaux compétents dans le ressort du siège social de la SCM S.O.S. 92 – Garde et Urgences Médicales, sous réserve des règles impératives applicables.</p>
          </section>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold transition-colors shadow-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
