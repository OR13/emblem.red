

const asset = `
18([
  <<{
    / Signature Algorithm    / 1: -7, 
    / Payload Hash Algorithm / -6800: -16, 
    / Location of Payload /
    -6801: "https://ihl-databases.icrc.org/en/customary-ihl/v1/rule29"
    / Content Type of Payload /
    -6802: "application/emblem+json",
  }>>, 
  {
    / Transparency Receipts / 394: [<<
      18([
        <<{
          / Signature Algorithm    / 1: -7, 
          / Transparency Algorithm / 395: 1
        }>>, 
        / Transparency Proofs / { 396: {
          -1: [<<[
            / Log Size / 4, 
            / Entry Index / 3, 
            / Inclusion Path / [h'0b317603a297...f074cf65d1ea6', h'2266e9ddea46...31821f94e92e7']
          ]>>]
        } }, 
        null, / Detached Payload is Merkle Tree Head /
        h'792ae3b6290bc8f47a189dbe63...781c49e1e762b0401aae0e'
      ])
    >>]
  }, 
  / sha-256 hash of {"message":"🀄 This target is protected under international law."} /
  h'd999ac786ac4e00ad8da8d5be69de997f0c429e4abd8c3f158012c078467c20c', 
  h'394c769c42b...405c977a6ac2'
])
`.trim()

const uri = "data:application/cbor-diagnostic;base64," + Buffer.from(new TextEncoder().encode(asset)).toString('base64');

export default uri