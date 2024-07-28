

const asset = `
18([
  <<{
    / Signature Algorithm    / 1: -7, 
    / Payload Hash Algorithm / -6800: -16, 
    / Payload Location /
    -6801: "https://ihl-databases.icrc.org/en/customary-ihl/v1/rule29"
    / Payload original Content Type /
    -6802: "application/emblem+json",
  }>>, 
  {
    / Transparency Receipts / 394: [<<
      18([
        <<{
          / Signature    / 1: -7, 
          / Transparency / 395: 1
        }>>, 
        / Transparency Proofs / { 396: {
          -1: [<<[
            / Log Size / 4, 
            / Entry Index / 3, 
            / Inclusion Path / [h'0b31...1ea6', h'2266...92e7']
          ]>>]
        } }, 
        null, / Becomes Merkle Tree Head /
        h'792a...ae0e'
      ])
    >>]
  }, 
  / sha-256 hash of {"message":"🀄 This target is protected under international law."} /
  h'd999...c20c', 
  h'394c...6ac2'
])
`.trim()

const uri = "data:application/cbor-diagnostic;base64," + Buffer.from(new TextEncoder().encode(asset)).toString('base64');

export default uri